import type { PlatformConfig } from 'homebridge'

export interface KasaDeviceConfig {
  name: string
  host: string
  protocol?: 'kasa' | 'tapo'
  tapoUsername?: string
  tapoPassword?: string
}

export interface EcobeeConfig {
  apiKey?: string
  refreshToken?: string
}

export interface AugustConfig {
  email?: string
  password?: string
  installId?: string
  lockId?: string
  lockName?: string
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
}

export function isHomeHubBridgeConfig(config: PlatformConfig): config is HomeHubBridgeConfig {
  return typeof config.httpApi === 'object' && config.httpApi !== null && typeof (config.httpApi as HttpApiConfig).token === 'string'
}
