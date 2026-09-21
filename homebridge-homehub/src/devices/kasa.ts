import type { LightDevice, LightStatus } from './types.js'
import { Buffer } from 'node:buffer'
import { Socket } from 'node:net'

/**
 * TP-Link's legacy local protocol (used by older Kasa-branded plugs/bulbs):
 * plain JSON over TCP port 9999, obfuscated with a single-byte XOR stream
 * cipher seeded at 171. This has been stable and publicly documented (via
 * community reverse-engineering, e.g. python-kasa) for years — unlike the
 * newer Tapo protocol, there's no real ambiguity in this implementation.
 */
function xorEncrypt(data: Buffer): Buffer {
  let key = 171
  const out = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i++) {
    const encrypted = data[i]! ^ key
    key = encrypted
    out[i] = encrypted
  }
  return out
}

function xorDecrypt(data: Buffer): Buffer {
  let key = 171
  const out = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i++) {
    const decrypted = data[i]! ^ key
    key = data[i]!
    out[i] = decrypted
  }
  return out
}

interface KasaSysinfo {
  alias: string
  relay_state?: number
  light_state?: { on_off: number, brightness?: number }
}

const KASA_PORT = 9999

function sendCommand(host: string, payload: unknown, port = KASA_PORT): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const socket = new Socket()
    const chunks: Buffer[] = []
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error(`Kasa device at ${host} timed out`))
    }, 5000)

    socket.connect(port, host, () => {
      const body = xorEncrypt(Buffer.from(JSON.stringify(payload)))
      const length = Buffer.alloc(4)
      length.writeUInt32BE(body.length, 0)
      socket.write(Buffer.concat([length, body]))
    })

    socket.on('data', chunk => chunks.push(chunk))
    socket.on('end', () => {
      clearTimeout(timeout)
      try {
        const full = Buffer.concat(chunks)
        const decrypted = xorDecrypt(full.subarray(4))
        resolve(JSON.parse(decrypted.toString('utf8')))
      }
      catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
    socket.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

async function getSysinfo(host: string, port: number): Promise<KasaSysinfo> {
  const response = await sendCommand(host, { system: { get_sysinfo: {} } }, port)
  const system = response.system as { get_sysinfo: KasaSysinfo } | undefined
  if (!system?.get_sysinfo) {
    throw new Error(`Unexpected response from Kasa device at ${host}`)
  }
  return system.get_sysinfo
}

/** `port` defaults to Kasa's fixed 9999 — only ever overridden in tests, against a fake local server. */
export function createKasaLight(id: string, name: string, host: string, options: { port?: number, room?: string } = {}): LightDevice {
  const port = options.port ?? KASA_PORT
  return {
    kind: 'light',
    id,
    name,
    room: options.room,
    async getStatus(): Promise<LightStatus> {
      const sysinfo = await getSysinfo(host, port)
      if (sysinfo.light_state) {
        return { on: sysinfo.light_state.on_off === 1, brightness: sysinfo.light_state.brightness ?? 100 }
      }
      return { on: sysinfo.relay_state === 1, brightness: sysinfo.relay_state === 1 ? 100 : 0 }
    },
    async setOn(on: boolean) {
      const sysinfo = await getSysinfo(host, port)
      if (sysinfo.light_state) {
        await sendCommand(host, {
          'smartlife.iot.smartbulb.lightingservice': {
            transition_light_state: { ignore_default: 1, on_off: on ? 1 : 0, transition_period: 0 },
          },
        }, port)
        return
      }
      await sendCommand(host, { system: { set_relay_state: { state: on ? 1 : 0 } } }, port)
    },
    async setBrightness(brightness: number) {
      await sendCommand(host, {
        'smartlife.iot.smartbulb.lightingservice': {
          transition_light_state: {
            ignore_default: 1,
            on_off: brightness > 0 ? 1 : 0,
            brightness: Math.round(brightness),
            transition_period: 0,
          },
        },
      }, port)
    },
  }
}
