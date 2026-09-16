import { describe, expect, it } from 'vitest'
import { __createSessionForTests, __internal } from './tapo.js'

describe('tapo securePassthrough AES envelope', () => {
  it('round-trips a JSON payload through encrypt/decrypt with the same session', () => {
    const session = __createSessionForTests()
    const payload = { method: 'get_device_info' }
    const encrypted = __internal.encryptPayload(session, payload)
    expect(typeof encrypted).toBe('string')
    expect(__internal.decryptPayload(session, encrypted)).toEqual(payload)
  })

  it('produces different ciphertext for different sessions', () => {
    const sessionA = __createSessionForTests()
    const sessionB = __createSessionForTests()
    const payload = { device_on: true }
    expect(__internal.encryptPayload(sessionA, payload)).not.toBe(__internal.encryptPayload(sessionB, payload))
  })
})
