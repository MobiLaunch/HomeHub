import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEcobeeThermostat, exchangeEcobeePin, requestEcobeePin } from './ecobee.js'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('ecobee pin flow', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('requests a pin', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ecobeePin: 'abcd-efgh', code: 'auth-code', interval: 30 }))
    const result = await requestEcobeePin('api-key')
    expect(result).toEqual({ ecobeePin: 'abcd-efgh', code: 'auth-code', interval: 30 })
  })

  it('throws a friendly error while the pin is still unauthorized', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ error: 'authorization_pending' }))
    await expect(exchangeEcobeePin('api-key', 'auth-code')).rejects.toThrow(/not yet authorized/)
  })

  it('exchanges an authorized pin for tokens', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'at', refresh_token: 'rt' }))
    await expect(exchangeEcobeePin('api-key', 'auth-code')).resolves.toEqual({ accessToken: 'at', refreshToken: 'rt' })
  })
})

describe('createEcobeeThermostat', () => {
  const originalFetch = globalThis.fetch
  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('refreshes the access token, reports the new refresh token, and converts tenths-of-a-degree F', async () => {
    const onTokenRefreshed = vi.fn()
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'at-1', refresh_token: 'rt-1' })) // refresh
      .mockResolvedValueOnce(jsonResponse({
        thermostatList: [{
          identifier: 'therm-1',
          name: 'Downstairs',
          runtime: { actualTemperature: 712, desiredHeat: 700, desiredCool: 750 },
          settings: { hvacMode: 'heat' },
        }],
      }))

    const thermostat = createEcobeeThermostat('api-key', 'initial-refresh', onTokenRefreshed)
    await expect(thermostat.getStatus()).resolves.toEqual({ currentTemp: 71.2, targetTemp: 70, mode: 'heat' })
    expect(onTokenRefreshed).toHaveBeenCalledWith('rt-1')
  })

  it('sends a setHold function with the temperature in tenths of a degree', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'at-1', refresh_token: 'rt-1' }))
      .mockResolvedValueOnce(jsonResponse({
        thermostatList: [{
          identifier: 'therm-1',
          name: 'Downstairs',
          runtime: { actualTemperature: 712, desiredHeat: 700, desiredCool: 750 },
          settings: { hvacMode: 'heat' },
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ status: { code: 0 } }))

    const thermostat = createEcobeeThermostat('api-key', 'initial-refresh', () => {})
    await thermostat.setTargetTemp(72)

    const setHoldCall = fetchMock.mock.calls[2]
    const body = JSON.parse((setHoldCall![1] as RequestInit).body as string)
    expect(body.functions[0].params.heatHoldTemp).toBe(720)
    expect(body.selection.selectionMatch).toBe('therm-1')
  })
})
