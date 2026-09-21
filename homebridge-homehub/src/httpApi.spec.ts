import type { Logging } from 'homebridge'
import type { Server } from 'node:http'
import type { Device, LightDevice, LockDevice, PlaybackState, SpeakerDevice, StreamingApp, TvDevice, TvRemoteKey, TvStatus } from './devices/types.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startHttpApi } from './httpApi.js'

const silentLog = { info: () => {}, warn: () => {}, error: () => {} } as unknown as Logging

function fakeLight(overrides: Partial<LightDevice> = {}): LightDevice {
  let state = { on: false, brightness: 0 }
  return {
    kind: 'light',
    id: 'light-1',
    name: 'Fake Light',
    getStatus: async () => state,
    setOn: async (on) => {
      state = { ...state, on }
    },
    setBrightness: async (brightness) => {
      state = { ...state, brightness }
    },
    ...overrides,
  }
}

function fakeLock(): LockDevice {
  let locked = false
  return {
    kind: 'lock',
    id: 'lock-1',
    name: 'Fake Lock',
    getStatus: async () => ({ locked }),
    setLocked: async (value) => {
      locked = value
    },
  }
}

function fakeSpeaker(): SpeakerDevice {
  let playback: PlaybackState = 'idle'
  let volume = 50
  let muted = false
  return {
    kind: 'speaker',
    id: 'speaker-1',
    name: 'Fake Speaker',
    getStatus: async () => ({ playback, volume, muted }),
    setPlayback: async (value) => {
      playback = value
    },
    setVolume: async (value) => {
      volume = value
    },
    setMuted: async (value) => {
      muted = value
    },
  }
}

function fakeTv(): TvDevice & { sentKeys: TvRemoteKey[], launchedApps: StreamingApp[] } {
  let on = false
  let playback: PlaybackState = 'idle'
  let volume = 20
  let muted = false
  const sentKeys: TvRemoteKey[] = []
  const launchedApps: StreamingApp[] = []
  return {
    kind: 'tv',
    id: 'tv-1',
    name: 'Fake TV',
    sentKeys,
    launchedApps,
    getStatus: async (): Promise<TvStatus> => ({ on, playback, volume, muted }),
    setOn: async (value) => {
      on = value
    },
    setPlayback: async (value) => {
      playback = value
    },
    setVolume: async (value) => {
      volume = value
    },
    setMuted: async (value) => {
      muted = value
    },
    sendRemoteKey: async (key) => {
      sentKeys.push(key)
    },
    launchApp: async (app) => {
      launchedApps.push(app)
    },
  }
}

describe('homeHub Bridge HTTP API', () => {
  let server: Server
  let baseUrl: string
  const token = 'test-token'
  let devices: Device[]

  beforeEach(async () => {
    devices = [fakeLight(), fakeLock()]
    const port = 20000 + Math.floor(Math.random() * 10000)
    server = startHttpApi(silentLog, { port, token }, devices)
    baseUrl = `http://127.0.0.1:${port}`
    await new Promise<void>(resolve => server.once('listening', () => resolve()))
  })

  afterEach(() => {
    server.close()
  })

  it('rejects requests without a valid bearer token', async () => {
    const res = await fetch(`${baseUrl}/status`)
    expect(res.status).toBe(401)
  })

  it('rejects requests with the wrong token', async () => {
    const res = await fetch(`${baseUrl}/status`, { headers: { Authorization: 'Bearer wrong' } })
    expect(res.status).toBe(401)
  })

  it('returns every device\'s status', async () => {
    const res = await fetch(`${baseUrl}/status`, { headers: { Authorization: `Bearer ${token}` } })
    const body = await res.json()
    expect(body.devices).toEqual([
      { id: 'light-1', kind: 'light', name: 'Fake Light', on: false, brightness: 0 },
      { id: 'lock-1', kind: 'lock', name: 'Fake Lock', locked: false },
    ])
  })

  it('applies a light command', async () => {
    await fetch(`${baseUrl}/devices/light-1/command`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ on: true, brightness: 80 }),
    })
    await expect(devices[0]!.getStatus()).resolves.toEqual({ on: true, brightness: 80 })
  })

  it('applies a lock command', async () => {
    await fetch(`${baseUrl}/devices/lock-1/command`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked: true }),
    })
    await expect(devices[1]!.getStatus()).resolves.toEqual({ locked: true })
  })

  it('404s for an unknown device id', async () => {
    const res = await fetch(`${baseUrl}/devices/does-not-exist/command`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ on: true }),
    })
    expect(res.status).toBe(404)
  })
})

describe('homeHub Bridge HTTP API — speaker and TV', () => {
  let server: Server
  let baseUrl: string
  const token = 'test-token'
  let speaker: ReturnType<typeof fakeSpeaker>
  let tv: ReturnType<typeof fakeTv>

  beforeEach(async () => {
    speaker = fakeSpeaker()
    tv = fakeTv()
    const port = 20000 + Math.floor(Math.random() * 10000)
    server = startHttpApi(silentLog, { port, token }, [speaker, tv])
    baseUrl = `http://127.0.0.1:${port}`
    await new Promise<void>(resolve => server.once('listening', () => resolve()))
  })

  afterEach(() => {
    server.close()
  })

  it('applies playback/volume/mute to a speaker', async () => {
    await fetch(`${baseUrl}/devices/speaker-1/command`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ playback: 'playing', volume: 65, muted: true }),
    })
    await expect(speaker.getStatus()).resolves.toEqual({ playback: 'playing', volume: 65, muted: true })
  })

  it('applies power, remote keys, and app launches to a TV', async () => {
    await fetch(`${baseUrl}/devices/tv-1/command`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ on: true, remoteKey: 'up', launchApp: 'youtube' }),
    })
    await expect(tv.getStatus()).resolves.toMatchObject({ on: true })
    expect(tv.sentKeys).toEqual(['up'])
    expect(tv.launchedApps).toEqual(['youtube'])
  })

  it('doesn\'t try to pair a non-TV device', async () => {
    const res = await fetch(`${baseUrl}/devices/speaker-1/pair`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(404)
  })
})
