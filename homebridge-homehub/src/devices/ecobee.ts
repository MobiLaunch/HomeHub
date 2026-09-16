import type { ClimateDevice, ClimateStatus, ThermostatMode } from './types.js'

/**
 * Ecobee's official, documented developer API (https://www.ecobee.com/home/developer/api/).
 * Auth is the "ecobeePin" flow: request a PIN, the user enters it once
 * under ecobee.com -> My Apps, then we exchange the authorization code for
 * a refresh token we can use indefinitely (refreshing the short-lived
 * access token as needed). This has been stable for a long time, unlike
 * the reverse-engineered protocols in tapo.ts/august.ts.
 */

const API_BASE = 'https://api.ecobee.com'
const CENTIGRADE_TENTHS_TO_F = 10 // ecobee reports temps in tenths of a degree F

export interface EcobeePinAuthorization {
  ecobeePin: string
  code: string
  interval: number
}

export async function requestEcobeePin(apiKey: string): Promise<EcobeePinAuthorization> {
  const url = `${API_BASE}/authorize?response_type=ecobeePin&client_id=${encodeURIComponent(apiKey)}&scope=smartWrite`
  const res = await fetch(url)
  const body = (await res.json()) as { ecobeePin: string, code: string, interval: number }
  return { ecobeePin: body.ecobeePin, code: body.code, interval: body.interval }
}

export async function exchangeEcobeePin(apiKey: string, code: string): Promise<{ accessToken: string, refreshToken: string }> {
  const url = `${API_BASE}/token?grant_type=ecobeePin&code=${encodeURIComponent(code)}&client_id=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, { method: 'POST' })
  const body = (await res.json()) as { access_token?: string, refresh_token?: string, error?: string }
  if (!body.access_token || !body.refresh_token) {
    throw new Error(body.error === 'authorization_pending'
      ? 'PIN not yet authorized — enter it at ecobee.com under My Apps, then try again'
      : `Ecobee PIN exchange failed: ${body.error ?? 'unknown error'}`)
  }
  return { accessToken: body.access_token, refreshToken: body.refresh_token }
}

async function refreshAccessToken(apiKey: string, refreshToken: string): Promise<{ accessToken: string, refreshToken: string }> {
  const url = `${API_BASE}/token?grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, { method: 'POST' })
  const body = (await res.json()) as { access_token?: string, refresh_token?: string, error?: string }
  if (!body.access_token || !body.refresh_token) {
    throw new Error(`Ecobee token refresh failed: ${body.error ?? 'unknown error'}`)
  }
  return { accessToken: body.access_token, refreshToken: body.refresh_token }
}

interface EcobeeRuntime {
  actualTemperature: number
  desiredHeat: number
  desiredCool: number
}
interface EcobeeSettings {
  hvacMode: string
}
interface EcobeeThermostat {
  identifier: string
  name: string
  runtime: EcobeeRuntime
  settings: EcobeeSettings
}

function toClimateStatus(t: EcobeeThermostat): ClimateStatus {
  const modeMap: Record<string, ThermostatMode> = { heat: 'heat', cool: 'cool', auto: 'auto', off: 'off' }
  const mode = modeMap[t.settings.hvacMode] ?? 'off'
  const targetTemp = mode === 'cool' ? t.runtime.desiredCool : t.runtime.desiredHeat
  return {
    currentTemp: t.runtime.actualTemperature / CENTIGRADE_TENTHS_TO_F,
    targetTemp: targetTemp / CENTIGRADE_TENTHS_TO_F,
    mode,
  }
}

/**
 * Handles refresh-token rotation itself: on every access-token refresh it
 * calls `onTokenRefreshed` so the caller can persist the new refresh token
 * (ecobee rotates it on each use — the old one stops working).
 */
export function createEcobeeThermostat(
  apiKey: string,
  initialRefreshToken: string,
  onTokenRefreshed: (refreshToken: string) => void,
): ClimateDevice & { identifier: () => Promise<string> } {
  let accessToken: string | null = null
  let refreshToken = initialRefreshToken
  let cachedIdentifier: string | null = null

  async function ensureAccessToken(): Promise<string> {
    if (accessToken)
      return accessToken
    const tokens = await refreshAccessToken(apiKey, refreshToken)
    accessToken = tokens.accessToken
    refreshToken = tokens.refreshToken
    onTokenRefreshed(refreshToken)
    return accessToken
  }

  async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    let token = await ensureAccessToken()
    let res = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
    if (res.status === 401) {
      // Access token expired mid-session — refresh once and retry.
      accessToken = null
      token = await ensureAccessToken()
      res = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
    }
    return res
  }

  async function fetchThermostat(): Promise<EcobeeThermostat> {
    const selection = encodeURIComponent(JSON.stringify({
      selection: { selectionType: 'registered', selectionMatch: '', includeRuntime: true, includeSettings: true },
    }))
    const res = await authedFetch(`/1/thermostat?format=json&body=${selection}`)
    const body = (await res.json()) as { thermostatList?: EcobeeThermostat[] }
    const thermostat = body.thermostatList?.[0]
    if (!thermostat)
      throw new Error('No registered Ecobee thermostat found on this account')
    cachedIdentifier = thermostat.identifier
    return thermostat
  }

  return {
    kind: 'climate',
    id: 'ecobee',
    name: 'Ecobee',
    async identifier() {
      if (cachedIdentifier)
        return cachedIdentifier
      await fetchThermostat()
      return cachedIdentifier!
    },
    async getStatus() {
      return toClimateStatus(await fetchThermostat())
    },
    async setTargetTemp(fahrenheit: number) {
      const identifier = cachedIdentifier ?? (await fetchThermostat()).identifier
      const tenths = Math.round(fahrenheit * CENTIGRADE_TENTHS_TO_F)
      await authedFetch('/1/thermostat?format=json', {
        method: 'POST',
        headers: { 'Content-Type': 'text/json' },
        body: JSON.stringify({
          selection: { selectionType: 'thermostats', selectionMatch: identifier },
          functions: [{ type: 'setHold', params: { holdType: 'nextTransition', heatHoldTemp: tenths, coolHoldTemp: tenths } }],
        }),
      })
    },
  }
}
