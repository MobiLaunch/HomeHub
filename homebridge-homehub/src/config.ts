import type { PlatformConfig } from 'homebridge'

export interface KasaDeviceConfig {
  name: string
  host: string
  protocol?: 'kasa' | 'tapo'
  tapoUsername?: string
  tapoPassword?: string
  room?: string
}

export interface EcobeeConfig {
  apiKey?: string
  refreshToken?: string
  room?: string
}

export interface AugustConfig {
  email?: string
  password?: string
  installId?: string
  lockId?: string
  lockName?: string
  room?: string
}

export interface GoogleCastSpeakerConfig {
  name: string
  host: string
  room?: string
}

export interface AndroidTvConfig {
  name: string
  host: string
  /** Filled in automatically after the one-time on-screen PIN pairing — see README. */
  cert?: { key: string, cert: string }
  room?: string
}

export interface HttpApiConfig {
  port?: number
  token: string
}

export interface HomeHubBridgeConfig extends PlatformConfig {
  httpApi: HttpApiConfig
  kasaDevices?: KasaDeviceConfig[]
  ecobee?: EcobeeConfig
  august?: AugustConfig
  googleCastSpeakers?: GoogleCastSpeakerConfig[]
  androidTvs?: AndroidTvConfig[]
}

export function isHomeHubBridgeConfig(config: PlatformConfig): config is HomeHubBridgeConfig {
  return typeof config.httpApi === 'object' && config.httpApi !== null && typeof (config.httpApi as HttpApiConfig).token === 'string'
}
