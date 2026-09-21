import type { Logging } from 'homebridge'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { HttpApiConfig } from './config.js'
import type { Device } from './devices/types.js'
import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'

const DEFAULT_PORT = 8582

function respondJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) })
  res.end(json)
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      }
      catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
    req.on('error', reject)
  })
}

function isAuthorized(req: IncomingMessage, token: string): boolean {
  const header = req.headers.authorization ?? ''
  const expected = `Bearer ${token}`
  const headerBuf = Buffer.from(header)
  const expectedBuf = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch rather than returning false —
  // this is a lock-control endpoint, so the comparison itself must not leak
  // token length/prefix info via response timing.
  return headerBuf.length === expectedBuf.length && timingSafeEqual(headerBuf, expectedBuf)
}

/** `createAndroidTv`'s return type, feature-detected at runtime — the `Device` union's `tv` member stays a plain `TvDevice` everywhere else so pairing stays an androidtv.ts concern. */
interface PairingCapable {
  pairingState: () => string
  startPairing: () => Promise<void>
  submitPairingCode: (code: string) => void
}
function asPairingCapable(device: Device): PairingCapable | null {
  return device.kind === 'tv' && 'startPairing' in device ? (device as unknown as PairingCapable) : null
}

async function applyCommand(device: Device, body: Record<string, unknown>): Promise<void> {
  if (device.kind === 'light') {
    if (typeof body.on === 'boolean')
      await device.setOn(body.on)
    if (typeof body.brightness === 'number')
      await device.setBrightness(body.brightness)
    return
  }
  if (device.kind === 'lock') {
    if (typeof body.locked === 'boolean')
      await device.setLocked(body.locked)
    return
  }
  if (device.kind === 'climate') {
    if (typeof body.targetTemp === 'number')
      await device.setTargetTemp(body.targetTemp)
    return
  }
  if (device.kind === 'speaker' || device.kind === 'tv') {
    if (device.kind === 'tv' && typeof body.on === 'boolean')
      await device.setOn(body.on)
    if (body.playback === 'playing' || body.playback === 'paused')
      await device.setPlayback(body.playback)
    if (typeof body.volume === 'number')
      await device.setVolume(body.volume)
    if (typeof body.muted === 'boolean')
      await device.setMuted(body.muted)
    if (device.kind === 'tv' && typeof body.remoteKey === 'string')
      await device.sendRemoteKey(body.remoteKey as Parameters<typeof device.sendRemoteKey>[0])
    if (device.kind === 'tv' && typeof body.launchApp === 'string')
      await device.launchApp(body.launchApp as Parameters<typeof device.launchApp>[0])
  }
}

async function describeDevice(device: Device): Promise<Record<string, unknown>> {
  const pairing = asPairingCapable(device)
  if (pairing && pairing.pairingState() !== 'paired') {
    return { id: device.id, kind: device.kind, name: device.name, room: device.room, pairingState: pairing.pairingState() }
  }
  try {
    const status = await device.getStatus()
    return { id: device.id, kind: device.kind, name: device.name, room: device.room, ...status }
  }
  catch (error) {
    return { id: device.id, kind: device.kind, name: device.name, room: device.room, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * The one thing HomeHub actually talks to: GET /status for a snapshot of
 * every device, POST /devices/:id/command to control one. Bearer-token
 * auth only (this is meant to sit on a trusted local network alongside
 * Homebridge itself, same threat model as Homebridge's own insecure mode
 * — not something to expose directly to the internet).
 */
export function startHttpApi(log: Logging, config: HttpApiConfig, devices: Device[]): Server {
  const port = config.port ?? DEFAULT_PORT

  const server = createServer((req, res) => {
    void (async () => {
      try {
        if (!isAuthorized(req, config.token)) {
          respondJson(res, 401, { error: 'unauthorized' })
          return
        }

        const url = new URL(req.url ?? '/', `http://localhost:${port}`)

        if (req.method === 'GET' && url.pathname === '/status') {
          const statuses = await Promise.all(devices.map(describeDevice))
          respondJson(res, 200, { devices: statuses })
          return
        }

        const commandMatch = /^\/devices\/([^/]+)\/command$/.exec(url.pathname)
        if (req.method === 'POST' && commandMatch) {
          const device = devices.find(d => d.id === commandMatch[1])
          if (!device) {
            respondJson(res, 404, { error: 'device not found' })
            return
          }
          const body = await readJsonBody(req)
          await applyCommand(device, body)
          respondJson(res, 200, { ok: true })
          return
        }

        // Android TV's one-time on-screen PIN pairing (see androidtv.ts) —
        // no other device kind needs an interactive setup step like this.
        const pairMatch = /^\/devices\/([^/]+)\/pair$/.exec(url.pathname)
        if (req.method === 'POST' && pairMatch) {
          const device = devices.find(d => d.id === pairMatch[1])
          const pairing = device && asPairingCapable(device)
          if (!device || !pairing) {
            respondJson(res, 404, { error: 'device not found or not pairable' })
            return
          }
          await pairing.startPairing()
          respondJson(res, 200, { pairingState: pairing.pairingState() })
          return
        }

        const pairCodeMatch = /^\/devices\/([^/]+)\/pair\/code$/.exec(url.pathname)
        if (req.method === 'POST' && pairCodeMatch) {
          const device = devices.find(d => d.id === pairCodeMatch[1])
          const pairing = device && asPairingCapable(device)
          if (!device || !pairing) {
            respondJson(res, 404, { error: 'device not found or not pairable' })
            return
          }
          const body = await readJsonBody(req)
          if (typeof body.code !== 'string') {
            respondJson(res, 400, { error: 'code is required' })
            return
          }
          pairing.submitPairingCode(body.code)
          respondJson(res, 200, { ok: true })
          return
        }

        respondJson(res, 404, { error: 'not found' })
      }
      catch (error) {
        log.error('HomeHub Bridge HTTP API error:', error)
        respondJson(res, 500, { error: 'internal error' })
      }
    })()
  })

  server.listen(port, () => log.info(`HomeHub Bridge HTTP API listening on :${port}`))
  return server
}
