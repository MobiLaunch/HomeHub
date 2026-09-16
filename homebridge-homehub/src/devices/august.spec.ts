import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAugustLock, generateAugustInstallId, listAugustLocks } from './august.js'

function response(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', ...headers } })
}

describe('generateAugustInstallId', () => {
  it('produces a distinct id each call', () => {
    expect(generateAugustInstallId()).not.toBe(generateAugustInstallId())
  })
})

describe('createAugustLock', () => {
  const originalFetch = globalThis.fetch
  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('throws a clear error when the account still needs verification', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(response({ vStatus: { email: false } }, { 'x-august-access-token': 'unverified-token' }))

    const lock = createAugustLock('lock-1', 'Front Door', 'install-1', 'me@example.com', 'hunter2')
    await expect(lock.getStatus()).rejects.toThrow(/not yet verified/)
  })

  it('reads lock status once verified', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce(response({ vStatus: { email: true } }, { 'x-august-access-token': 'verified-token' }))
      .mockResolvedValueOnce(response({ status: 'kAugLockState_Locked' }))

    const lock = createAugustLock('lock-1', 'Front Door', 'install-1', 'me@example.com', 'hunter2')
    await expect(lock.getStatus()).resolves.toEqual({ locked: true })
  })

  it('sends a remoteoperate lock command', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce(response({ vStatus: { email: true } }, { 'x-august-access-token': 'verified-token' }))
      .mockResolvedValueOnce(response({}))

    const lock = createAugustLock('lock-1', 'Front Door', 'install-1', 'me@example.com', 'hunter2')
    await lock.setLocked(true)

    const operateCall = fetchMock.mock.calls[1]
    expect(operateCall![0]).toContain('/remoteoperate/lock-1/lock')
    expect((operateCall![1] as RequestInit).method).toBe('PUT')
  })
})

describe('listAugustLocks', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('maps the locks object into an array', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(response({ vStatus: { email: true } }, { 'x-august-access-token': 'verified-token' }))
      .mockResolvedValueOnce(response({ 'lock-1': { LockName: 'Front Door' }, 'lock-2': { LockName: 'Back Door' } }))

    await expect(listAugustLocks('install-1', 'me@example.com', 'hunter2')).resolves.toEqual([
      { LockID: 'lock-1', LockName: 'Front Door' },
      { LockID: 'lock-2', LockName: 'Back Door' },
    ])
  })
})
