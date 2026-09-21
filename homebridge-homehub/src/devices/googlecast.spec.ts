import type { Client, MediaStatus, ReceiverApplication } from 'castv2-client'
import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { createCastMediaController, createGoogleCastSpeaker } from './googlecast.js'

/**
 * A fake castv2-client `Client` — `join()` ignores the Application
 * constructor it's handed and returns our own fake media controller, since
 * only its shape (`.media.getStatus/play/pause`) is ever touched.
 */
class FakeCastClient extends EventEmitter {
  volume = { level: 0.5, muted: false }
  session: ReceiverApplication | undefined = { appId: 'CC1AD845', displayName: 'Fake App', sessionId: 's-1', transportId: 't-1' }
  mediaStatus: MediaStatus = { playerState: 'PLAYING', mediaSessionId: 1, media: { metadata: { title: 'Test Song', subtitle: 'Test Artist' } } }

  connect(_options: unknown, callback: () => void): void {
    queueMicrotask(callback)
  }

  close(): void {}

  getStatus(callback: (error: Error | null, status: { applications?: ReceiverApplication[], volume: typeof this.volume }) => void): void {
    callback(null, { applications: this.session ? [this.session] : [], volume: this.volume })
  }

  setVolume(options: { level?: number, muted?: boolean }, callback?: (error: Error | null, volume: typeof this.volume) => void): void {
    if (options.level !== undefined)
      this.volume.level = options.level
    if (options.muted !== undefined)
      this.volume.muted = options.muted
    callback?.(null, this.volume)
  }

  join(_session: ReceiverApplication, _Ctor: unknown, callback: (error: Error | null, app: { media: FakeCastClient['mediaController'] } | null) => void): void {
    callback(null, { media: this.mediaController })
  }

  mediaController = {
    getStatus: (callback: (error: Error | null, status: MediaStatus) => void) => callback(null, this.mediaStatus),
    play: (callback?: (error: Error | null, status: MediaStatus) => void) => {
      this.mediaStatus = { ...this.mediaStatus, playerState: 'PLAYING' }
      callback?.(null, this.mediaStatus)
    },
    pause: (callback?: (error: Error | null, status: MediaStatus) => void) => {
      this.mediaStatus = { ...this.mediaStatus, playerState: 'PAUSED' }
      callback?.(null, this.mediaStatus)
    },
  }
}

describe('createCastMediaController', () => {
  it('reports volume, mute, playback, and now-playing from an active session', async () => {
    const fake = new FakeCastClient()
    const controller = createCastMediaController('192.168.1.10', { clientFactory: () => fake as unknown as Client })

    await expect(controller.getStatus()).resolves.toEqual({
      playback: 'playing',
      volume: 50,
      muted: false,
      nowPlaying: { title: 'Test Song', subtitle: 'Test Artist', imageUrl: undefined },
    })
  })

  it('reports idle with no now-playing when nothing is casting', async () => {
    const fake = new FakeCastClient()
    fake.session = undefined
    const controller = createCastMediaController('192.168.1.10', { clientFactory: () => fake as unknown as Client })

    await expect(controller.getStatus()).resolves.toEqual({ playback: 'idle', volume: 50, muted: false, nowPlaying: undefined })
  })

  it('sets device volume as a 0-1 fraction', async () => {
    const fake = new FakeCastClient()
    const controller = createCastMediaController('192.168.1.10', { clientFactory: () => fake as unknown as Client })

    await controller.setVolume(80)
    expect(fake.volume.level).toBeCloseTo(0.8)
  })

  it('mutes without touching the level', async () => {
    const fake = new FakeCastClient()
    const controller = createCastMediaController('192.168.1.10', { clientFactory: () => fake as unknown as Client })

    await controller.setMuted(true)
    expect(fake.volume.muted).toBe(true)
    expect(fake.volume.level).toBeCloseTo(0.5)
  })

  it('joins the active session to pause it', async () => {
    const fake = new FakeCastClient()
    const controller = createCastMediaController('192.168.1.10', { clientFactory: () => fake as unknown as Client })

    await controller.setPlayback('paused')
    await expect(controller.getStatus()).resolves.toMatchObject({ playback: 'paused' })
  })

  it('throws when trying to control playback with nothing casting', async () => {
    const fake = new FakeCastClient()
    fake.session = undefined
    const controller = createCastMediaController('192.168.1.10', { clientFactory: () => fake as unknown as Client })

    await expect(controller.setPlayback('playing')).rejects.toThrow(/Nothing is currently casting/)
  })
})

describe('createGoogleCastSpeaker', () => {
  it('builds a SpeakerDevice backed by the cast controller', async () => {
    const fake = new FakeCastClient()
    const speaker = createGoogleCastSpeaker('cast-1', 'Kitchen Speaker', '192.168.1.10', 'Kitchen', { clientFactory: () => fake as unknown as Client })

    expect(speaker.kind).toBe('speaker')
    expect(speaker.room).toBe('Kitchen')
    await expect(speaker.getStatus()).resolves.toMatchObject({ playback: 'playing', volume: 50 })
  })
})
