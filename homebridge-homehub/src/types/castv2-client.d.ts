// castv2-client (https://github.com/thibauts/node-castv2-client) has no
// published types — this covers only the subset of its callback-based API
// that googlecast.ts actually uses.
declare module 'castv2-client' {
  import { EventEmitter } from 'node:events'

  export interface ReceiverVolume {
    level: number
    muted: boolean
  }

  export interface ReceiverApplication {
    appId: string
    displayName: string
    sessionId: string
    transportId: string
  }

  export interface ReceiverStatus {
    applications?: ReceiverApplication[]
    volume: ReceiverVolume
  }

  export interface MediaMetadata {
    title?: string
    subtitle?: string
    images?: Array<{ url: string }>
  }

  export interface MediaStatus {
    playerState: 'IDLE' | 'PLAYING' | 'PAUSED' | 'BUFFERING'
    media?: { metadata?: MediaMetadata }
    mediaSessionId: number
  }

  export class MediaController extends EventEmitter {
    getStatus: (callback: (err: Error | null, status: MediaStatus) => void) => void
    play: (callback?: (err: Error | null, status: MediaStatus) => void) => void
    pause: (callback?: (err: Error | null, status: MediaStatus) => void) => void
  }

  export class Application extends EventEmitter {
    constructor(client: Client, session: ReceiverApplication)
    close: () => void
  }

  export class DefaultMediaReceiver extends Application {
    static APP_ID: string
    media: MediaController
  }

  type ApplicationCtor<T extends Application> = new (client: Client, session: ReceiverApplication) => T

  export class Client extends EventEmitter {
    connect: (options: { host: string, port?: number }, callback: () => void) => void
    close: () => void
    getStatus: (callback: (err: Error | null, status: ReceiverStatus) => void) => void
    setVolume: (options: { level?: number, muted?: boolean }, callback?: (err: Error | null, volume: ReceiverVolume) => void) => void
    join: <T extends Application>(session: ReceiverApplication, Ctor: ApplicationCtor<T>, callback: (err: Error | null, app: T) => void) => void
  }
}
