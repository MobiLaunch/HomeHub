import type { Application, Client, MediaStatus, ReceiverApplication } from 'castv2-client'
import type { MediaNowPlaying, PlaybackState, SpeakerDevice, SpeakerStatus } from './types.js'
import { DefaultMediaReceiver, Client as PlatformSender } from 'castv2-client'

/**
 * Google Cast (the CASTV2 protocol) — unofficial (Google publishes no
 * public API for it) but extremely stable and widely used; this is the
 * same local protocol every Google Home speaker and every Google TV /
 * Android TV device's built-in Cast receiver speaks. High confidence,
 * unlike tapo.ts/august.ts.
 *
 * There's no "now playing" without something actually loaded into a media
 * session — `client.join()` attaches to whatever app is already running
 * (Spotify, YouTube Music, the TV's own receiver, ...) instead of
 * launching a new one, so playback control never interrupts what's
 * already casting. Device volume/mute work at the receiver level
 * regardless of what's running.
 */

export type CastClientFactory = () => Client

const defaultClientFactory: CastClientFactory = () => new PlatformSender()

function toPlaybackState(playerState?: MediaStatus['playerState']): PlaybackState {
  if (playerState === 'PLAYING' || playerState === 'BUFFERING')
    return 'playing'
  if (playerState === 'PAUSED')
    return 'paused'
  return 'idle'
}

function toNowPlaying(status?: MediaStatus): MediaNowPlaying | undefined {
  const metadata = status?.media?.metadata
  if (!metadata?.title)
    return undefined
  return { title: metadata.title, subtitle: metadata.subtitle, imageUrl: metadata.images?.[0]?.url }
}

export interface CastMediaController {
  getStatus: () => Promise<SpeakerStatus>
  setPlayback: (playback: 'playing' | 'paused') => Promise<void>
  setVolume: (volume: number) => Promise<void>
  setMuted: (muted: boolean) => Promise<void>
}

export function createCastMediaController(host: string, options: { port?: number, clientFactory?: CastClientFactory } = {}): CastMediaController {
  const clientFactory = options.clientFactory ?? defaultClientFactory

  function connect(): Promise<Client> {
    return new Promise((resolve, reject) => {
      const client = clientFactory()
      const onError = (error: Error): void => reject(error)
      client.once('error', onError)
      client.connect({ host, port: options.port }, () => {
        client.removeListener('error', onError)
        resolve(client)
      })
    })
  }

  async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = await connect()
    try {
      return await fn(client)
    }
    finally {
      client.close()
    }
  }

  function getReceiverStatus(client: Client): Promise<{ applications?: ReceiverApplication[], volume: { level: number, muted: boolean } }> {
    return new Promise((resolve, reject) => {
      client.getStatus((error, status) => (error ? reject(error) : resolve(status)))
    })
  }

  function joinActiveSession(client: Client, session: ReceiverApplication): Promise<Application & { media: DefaultMediaReceiver['media'] }> {
    return new Promise((resolve, reject) => {
      client.join(session, DefaultMediaReceiver, (error, app) => (error || !app ? reject(error ?? new Error('Failed to join cast session')) : resolve(app)))
    })
  }

  async function getActiveMediaStatus(client: Client, session: ReceiverApplication | undefined): Promise<MediaStatus | undefined> {
    if (!session)
      return undefined
    try {
      const app = await joinActiveSession(client, session)
      return await new Promise<MediaStatus>((resolve, reject) => {
        app.media.getStatus((error, status) => (error ? reject(error) : resolve(status)))
      })
    }
    catch {
      // Nothing meaningfully "now playing" (session just ended, app doesn't
      // implement the media namespace, etc.) — device volume is still valid.
      return undefined
    }
  }

  return {
    async getStatus(): Promise<SpeakerStatus> {
      return withClient(async (client) => {
        const receiverStatus = await getReceiverStatus(client)
        const mediaStatus = await getActiveMediaStatus(client, receiverStatus.applications?.[0])
        return {
          playback: toPlaybackState(mediaStatus?.playerState),
          volume: Math.round((receiverStatus.volume?.level ?? 0) * 100),
          muted: Boolean(receiverStatus.volume?.muted),
          nowPlaying: toNowPlaying(mediaStatus),
        }
      })
    },

    async setVolume(volume: number): Promise<void> {
      await withClient(client => new Promise<void>((resolve, reject) => {
        client.setVolume({ level: Math.min(1, Math.max(0, volume / 100)) }, error => (error ? reject(error) : resolve()))
      }))
    },

    async setMuted(muted: boolean): Promise<void> {
      await withClient(client => new Promise<void>((resolve, reject) => {
        client.setVolume({ muted }, error => (error ? reject(error) : resolve()))
      }))
    },

    async setPlayback(playback: 'playing' | 'paused'): Promise<void> {
      await withClient(async (client) => {
        const receiverStatus = await getReceiverStatus(client)
        const session = receiverStatus.applications?.[0]
        if (!session)
          throw new Error('Nothing is currently casting to this device')
        const app = await joinActiveSession(client, session)
        await new Promise<void>((resolve, reject) => {
          const callback = (error: Error | null): void => (error ? reject(error) : resolve())
          if (playback === 'playing')
            app.media.play(callback)
          else
            app.media.pause(callback)
        })
      })
    },
  }
}

export function createGoogleCastSpeaker(
  id: string,
  name: string,
  host: string,
  room?: string,
  options: { port?: number, clientFactory?: CastClientFactory } = {},
): SpeakerDevice {
  const controller = createCastMediaController(host, options)
  return {
    kind: 'speaker',
    id,
    name,
    room,
    getStatus: controller.getStatus,
    setPlayback: controller.setPlayback,
    setVolume: controller.setVolume,
    setMuted: controller.setMuted,
  }
}
