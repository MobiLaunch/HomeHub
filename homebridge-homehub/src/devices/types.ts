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
  room?: string
  getStatus: () => Promise<LightStatus>
  setOn: (on: boolean) => Promise<void>
  setBrightness: (brightness: number) => Promise<void>
}

export interface LockDevice {
  kind: 'lock'
  id: string
  name: string
  room?: string
  getStatus: () => Promise<LockStatus>
  setLocked: (locked: boolean) => Promise<void>
}

export interface ClimateDevice {
  kind: 'climate'
  id: string
  name: string
  room?: string
  getStatus: () => Promise<ClimateStatus>
  setTargetTemp: (fahrenheit: number) => Promise<void>
}

export type PlaybackState = 'playing' | 'paused' | 'idle'

export interface MediaNowPlaying {
  title: string
  subtitle?: string
  imageUrl?: string
}

export interface SpeakerStatus {
  playback: PlaybackState
  /** 0-100 device volume — works regardless of what's casting, unlike playback/nowPlaying. */
  volume: number
  muted: boolean
  nowPlaying?: MediaNowPlaying
}

export interface SpeakerDevice {
  kind: 'speaker'
  id: string
  name: string
  room?: string
  getStatus: () => Promise<SpeakerStatus>
  setPlayback: (playback: 'playing' | 'paused') => Promise<void>
  setVolume: (volume: number) => Promise<void>
  setMuted: (muted: boolean) => Promise<void>
}

export interface TvStatus extends SpeakerStatus {
  on: boolean
}

export type TvRemoteKey =
  | 'rewind' | 'fast_forward' | 'next_track' | 'previous_track'
  | 'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'exit'
  | 'play_pause' | 'information'

export interface TvDevice {
  kind: 'tv'
  id: string
  name: string
  room?: string
  getStatus: () => Promise<TvStatus>
  setOn: (on: boolean) => Promise<void>
  setPlayback: (playback: 'playing' | 'paused') => Promise<void>
  setVolume: (volume: number) => Promise<void>
  setMuted: (muted: boolean) => Promise<void>
  sendRemoteKey: (key: TvRemoteKey) => Promise<void>
}

export type Device = LightDevice | LockDevice | ClimateDevice | SpeakerDevice | TvDevice
