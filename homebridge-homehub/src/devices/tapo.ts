import type { LightDevice, LightStatus } from './types.js'
import { Buffer } from 'node:buffer'
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  constants as cryptoConstants,
  generateKeyPairSync,
  privateDecrypt,
  randomBytes,
} from 'node:crypto'

/**
 * TP-Link's newer Tapo local protocol ("securePassthrough"): an RSA
 * handshake establishes an AES session, then every request/response is
 * AES-CBC encrypted JSON, base64-wrapped inside an outer envelope.
 *
 * Unlike kasa.ts, this is NOT something with a stable public spec — it's
 * reverse-engineered (same approach as python-kasa's Tapo support and
 * pytapo), and TP-Link has changed it across firmware revisions. Newer
 * Tapo firmware often defaults to a different protocol ("KLAP") and needs
 * "Secure Connect" turned on in the Tapo app's advanced device settings
 * before this securePassthrough flow will work at all. Treat this client
 * as a best-effort starting point to validate against real hardware, not
 * as a guaranteed-correct implementation the way kasa.ts is.
 */

interface TapoSession {
  cookie: string
  aesKey: Buffer
  aesIv: Buffer
  token?: string
}

async function handshake(host: string): Promise<TapoSession> {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 })
  const publicKeyPem = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString()

  const res = await fetch(`http://${host}/app`, {
    method: 'POST',
    body: JSON.stringify({ method: 'handshake', params: { key: publicKeyPem } }),
  })
  const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? ''
  const body = (await res.json()) as { error_code: number, result?: { key: string } }
  if (body.error_code !== 0 || !body.result) {
    throw new Error(`Tapo handshake with ${host} failed (error_code ${body.error_code})`)
  }

  const decrypted = privateDecrypt(
    { key: privateKey, padding: cryptoConstants.RSA_PKCS1_PADDING },
    Buffer.from(body.result.key, 'base64'),
  )
  return { cookie, aesKey: decrypted.subarray(0, 16), aesIv: decrypted.subarray(16, 32) }
}

function encryptPayload(session: TapoSession, payload: unknown): string {
  const cipher = createCipheriv('aes-128-cbc', session.aesKey, session.aesIv)
  const json = Buffer.from(JSON.stringify(payload), 'utf8')
  return Buffer.concat([cipher.update(json), cipher.final()]).toString('base64')
}

function decryptPayload(session: TapoSession, base64: string): Record<string, unknown> {
  const decipher = createDecipheriv('aes-128-cbc', session.aesKey, session.aesIv)
  const plain = Buffer.concat([decipher.update(Buffer.from(base64, 'base64')), decipher.final()])
  return JSON.parse(plain.toString('utf8'))
}

async function securePassthrough(host: string, session: TapoSession, payload: unknown): Promise<Record<string, unknown>> {
  const url = session.token ? `http://${host}/app?token=${session.token}` : `http://${host}/app`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Cookie: session.cookie },
    body: JSON.stringify({ method: 'securePassthrough', params: { request: encryptPayload(session, payload) } }),
  })
  const body = (await res.json()) as { error_code: number, result?: { response: string } }
  if (body.error_code !== 0 || !body.result) {
    throw new Error(`Tapo request to ${host} failed (error_code ${body.error_code})`)
  }
  return decryptPayload(session, body.result.response)
}

async function login(host: string, session: TapoSession, username: string, password: string): Promise<string> {
  const usernameHash = createHash('sha1').update(username).digest('hex')
  const result = await securePassthrough(host, session, {
    method: 'login_device',
    params: {
      username: Buffer.from(usernameHash).toString('base64'),
      password: Buffer.from(password).toString('base64'),
    },
  })
  const inner = result.result as { token?: string } | undefined
  if (!inner?.token) {
    throw new Error(`Tapo login to ${host} failed — check tapoUsername/tapoPassword`)
  }
  return inner.token
}

// A fresh handshake+login per call keeps this simple and avoids stale
// session bugs; Tapo devices handle this fine for a dashboard's polling
// cadence (tens of requests/minute, not hundreds).
async function connect(host: string, username: string, password: string): Promise<TapoSession> {
  const session = await handshake(host)
  session.token = await login(host, session, username, password)
  return session
}

async function getDeviceInfo(host: string, username: string, password: string): Promise<Record<string, unknown>> {
  const session = await connect(host, username, password)
  const result = await securePassthrough(host, session, { method: 'get_device_info' })
  return (result.result as Record<string, unknown>) ?? {}
}

async function setDeviceInfo(host: string, username: string, password: string, params: Record<string, unknown>): Promise<void> {
  const session = await connect(host, username, password)
  await securePassthrough(host, session, { method: 'set_device_info', params })
}

export function createTapoLight(id: string, name: string, host: string, username: string, password: string, room?: string): LightDevice {
  return {
    kind: 'light',
    id,
    name,
    room,
    async getStatus(): Promise<LightStatus> {
      const info = await getDeviceInfo(host, username, password)
      return { on: Boolean(info.device_on), brightness: typeof info.brightness === 'number' ? info.brightness : 100 }
    },
    async setOn(on: boolean) {
      await setDeviceInfo(host, username, password, { device_on: on })
    },
    async setBrightness(brightness: number) {
      await setDeviceInfo(host, username, password, { device_on: brightness > 0, brightness: Math.round(brightness) })
    },
  }
}

// Re-exported for tests to exercise the crypto without a live device.
export const __internal = { encryptPayload, decryptPayload }
export function __createSessionForTests(): TapoSession {
  const keyIv = randomBytes(32)
  return { cookie: 'test', aesKey: keyIv.subarray(0, 16), aesIv: keyIv.subarray(16, 32) }
}
