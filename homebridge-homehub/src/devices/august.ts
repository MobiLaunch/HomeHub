import type { LockDevice, LockStatus } from './types.js'
import { randomUUID } from 'node:crypto'

/**
 * August's cloud API has no official public documentation — this mirrors
 * the request shapes used by community reverse-engineering efforts (the
 * same general flow as the yalexs/pyaugust Python libraries). August/Yale
 * have changed their backend before (the "Yale Home" cloud migration), so
 * treat this as a best-effort client that may need updating, not a
 * guaranteed-stable integration the way ecobee.ts is.
 */

const API_BASE = 'https://api-production.august.com'
// Public key baked into August's own official apps; used by every
// community client since there's no per-developer registration.
const API_KEY = '79fd0eb6-381d-4adf-95a0-47721289d1d9'

function baseHeaders(installId: string): Record<string, string> {
  return {
    'Accept-Version': '0.0.1',
    'User-Agent': 'August/Luna-3.2.2 (iPhone; iOS 14.7; Scale/3.00)',
    'x-august-api-key': API_KEY,
    'x-kease-api-key': API_KEY,
    'Content-Type': 'application/json',
    'x-august-access-token': '',
    'install-id': installId,
  }
}

interface SessionResult {
  accessToken: string
  requiresVerification: boolean
}

async function requestSession(installId: string, email: string, password: string): Promise<SessionResult> {
  const res = await fetch(`${API_BASE}/session`, {
    method: 'POST',
    headers: baseHeaders(installId),
    body: JSON.stringify({ installId, identifier: `email:${email}`, password }),
  })
  const accessToken = res.headers.get('x-august-access-token') ?? ''
  const body = (await res.json()) as { vStatus?: { email?: boolean } }
  return { accessToken, requiresVerification: body.vStatus?.email !== true }
}

/** Call once, out of band, when `requiresVerification` comes back true — August emails a code to the account. */
export async function requestAugustVerificationCode(installId: string, email: string): Promise<void> {
  await fetch(`${API_BASE}/validation/email`, {
    method: 'POST',
    headers: baseHeaders(installId),
    body: JSON.stringify({ value: email }),
  })
}

/** Submits the emailed code once to fully validate this installId — after this, requestSession() alone is enough forever. */
export async function submitAugustVerificationCode(installId: string, accessToken: string, email: string, code: string): Promise<void> {
  const headers = { ...baseHeaders(installId), 'x-august-access-token': accessToken }
  await fetch(`${API_BASE}/validate/email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code, email }),
  })
}

export function generateAugustInstallId(): string {
  return randomUUID()
}

interface AugustLockSummary {
  LockID: string
  LockName: string
}

interface AugustLockStatus {
  status: 'kAugLockState_Locked' | 'kAugLockState_Unlocked' | string
}

async function authedFetch(installId: string, accessToken: string, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...baseHeaders(installId), 'x-august-access-token': accessToken, ...init.headers }
  return fetch(`${API_BASE}${path}`, { ...init, headers })
}

export function createAugustLock(
  id: string,
  name: string,
  installId: string,
  email: string,
  password: string,
): LockDevice {
  let accessToken: string | null = null

  async function ensureSession(): Promise<string> {
    if (accessToken)
      return accessToken
    const session = await requestSession(installId, email, password)
    if (session.requiresVerification) {
      throw new Error(
        `August account not yet verified for installId ${installId} — call requestAugustVerificationCode then submitAugustVerificationCode once (see README)`,
      )
    }
    accessToken = session.accessToken
    return accessToken
  }

  return {
    kind: 'lock',
    id,
    name,
    async getStatus(): Promise<LockStatus> {
      const token = await ensureSession()
      const res = await authedFetch(installId, token, `/locks/${id}/status`)
      const body = (await res.json()) as AugustLockStatus
      return { locked: body.status === 'kAugLockState_Locked' }
    },
    async setLocked(locked: boolean) {
      const token = await ensureSession()
      await authedFetch(installId, token, `/remoteoperate/${id}/${locked ? 'lock' : 'unlock'}`, { method: 'PUT' })
    },
  }
}

export async function listAugustLocks(installId: string, email: string, password: string): Promise<AugustLockSummary[]> {
  const session = await requestSession(installId, email, password)
  if (session.requiresVerification) {
    throw new Error('August account not yet verified for this installId — see README')
  }
  const res = await authedFetch(installId, session.accessToken, '/locks')
  const body = (await res.json()) as Record<string, { LockName: string }>
  return Object.entries(body).map(([LockID, v]) => ({ LockID, LockName: v.LockName }))
}
