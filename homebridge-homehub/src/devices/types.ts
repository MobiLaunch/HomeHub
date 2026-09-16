export type ThermostatMode = 'heat' | 'cool' | 'auto' | 'off'

export interface LightStatus {
  on: boolean
  brightness: number
}

export interface LockStatus {
  locked: boolean
}

export interface ClimateStatus {
  currentTemp: number
  targetTemp: number
  mode: ThermostatMode
}

export interface LightDevice {
  kind: 'light'
  id: string
  name: string
  getStatus: () => Promise<LightStatus>
  setOn: (on: boolean) => Promise<void>
  setBrightness: (brightness: number) => Promise<void>
}

export interface LockDevice {
  kind: 'lock'
  id: string
  name: string
  getStatus: () => Promise<LockStatus>
  setLocked: (locked: boolean) => Promise<void>
}

export interface ClimateDevice {
  kind: 'climate'
  id: string
  name: string
  getStatus: () => Promise<ClimateStatus>
  setTargetTemp: (fahrenheit: number) => Promise<void>
}

export type Device = LightDevice | LockDevice | ClimateDevice
