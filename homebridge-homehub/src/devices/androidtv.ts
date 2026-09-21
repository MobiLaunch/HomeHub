import type { AndroidRemote, AndroidRemoteOptions, Certificate } from '@kud/androidtv-remote'
import type { CastClientFactory } from './googlecast.js'
import type { StreamingApp, TvDevice, TvRemoteKey, TvStatus } from './types.js'
import { createAndroidRemote, RemoteKeyCode } from '@kud/androidtv-remote'
import { createCastMediaController } from './googlecast.js'

/**
 * Android TV Remote v2 — a separate local protocol from Cast, used only
 * for real remote control (power, D-pad, media keys). Unofficial, but a
 * modern, actively maintained implementation with a proper TLS pairing
 * flow (the TV shows a PIN once; after that it reconnects silently using
 * the saved certificate — same shape as Ecobee's PIN/August's
 * verification-code onboarding elsewhere in this plugin).
 *
 * The protocol only reports a foreground package name, not real
 * play/pause/now-playing state, so those are delegated to the device's
 * Cast receiver (see googlecast.ts) — a Google TV is also a Cast device.
 */

export type AndroidTvPairingState = 'unpaired' | 'awaiting_code' | 'paired'

export type AndroidTvRemoteFactory = (host: string, options?: AndroidRemoteOptions) => AndroidRemote

// Android's standard KeyEvent constants (stable across the whole Android
// ecosystem, not specific to this protocol) — the exact set this library
// exposes may still shift release to release, so keys outside this map
// throw rather than silently no-op.
const KEY_MAP: Partial<Record<TvRemoteKey, number>> = {
  rewind: RemoteKeyCode.KEYCODE_MEDIA_REWIND,
  fast_forward: RemoteKeyCode.KEYCODE_MEDIA_FAST_FORWARD,
  next_track: RemoteKeyCode.KEYCODE_MEDIA_NEXT,
  previous_track: RemoteKeyCode.KEYCODE_MEDIA_PREVIOUS,
  up: RemoteKeyCode.KEYCODE_DPAD_UP,
  down: RemoteKeyCode.KEYCODE_DPAD_DOWN,
  left: RemoteKeyCode.KEYCODE_DPAD_LEFT,
  right: RemoteKeyCode.KEYCODE_DPAD_RIGHT,
  select: RemoteKeyCode.KEYCODE_DPAD_CENTER,
  back: RemoteKeyCode.KEYCODE_BACK,
  exit: RemoteKeyCode.KEYCODE_HOME,
  play_pause: RemoteKeyCode.KEYCODE_MEDIA_PLAY_PAUSE,
  information: RemoteKeyCode.KEYCODE_INFO,
}

// `sendAppLink` hands a URI to the TV for Android's normal intent
// resolution — these are each app's registered Android App Link domain,
// the same links Home Assistant's androidtv_remote integration uses for
// its source list. Works when the app is installed and has registered
// that link (true of all of these on stock Google TV); a heavily
// customized manufacturer build could behave differently.
const APP_LINKS: Record<StreamingApp, string> = {
  netflix: 'https://www.netflix.com',
  youtube: 'https://www.youtube.com',
  disney_plus: 'https://www.disneyplus.com',
  hulu: 'https://www.hulu.com',
  prime_video: 'https://app.primevideo.com',
  max: 'https://play.max.com',
  apple_tv: 'https://tv.apple.com',
  spotify: 'https://open.spotify.com',
}

export interface PairableTvDevice extends TvDevice {
  pairingState: () => AndroidTvPairingState
  /** Kicks off pairing; resolves once the TV is showing a PIN (or immediately if a saved cert turns out to still be valid). */
  startPairing: () => Promise<void>
  /** Submits the PIN shown on the TV. */
  submitPairingCode: (code: string) => void
}

export function createAndroidTv(
  id: string,
  name: string,
  host: string,
  options: {
    cert?: Certificate
    onCertificate?: (cert: Certificate) => void
    remoteFactory?: AndroidTvRemoteFactory
    castClientFactory?: CastClientFactory
  } = {},
  room?: string,
): PairableTvDevice {
  const remoteFactory = options.remoteFactory ?? createAndroidRemote
  const cast = createCastMediaController(host, { clientFactory: options.castClientFactory })

  let remote: AndroidRemote | null = null
  let state: AndroidTvPairingState = options.cert ? 'paired' : 'unpaired'
  let poweredOn = false
  let connectPromise: Promise<void> | null = null

  function buildRemote(cert?: Certificate): AndroidRemote {
    const r = remoteFactory(host, { cert, manufacturer: 'HomeHub', model: 'homebridge-homehub' })
    r.on('powered', (on) => {
      poweredOn = on
    })
    r.on('secret', () => {
      state = 'awaiting_code'
    })
    r.on('ready', () => {
      state = 'paired'
      options.onCertificate?.(r.getCertificate())
    })
    r.on('unpaired', () => {
      state = 'unpaired'
      remote = null
    })
    // The library emits 'error' for transient connection issues too —
    // letting them go unhandled would crash the Homebridge process.
    r.on('error', () => {})
    return r
  }

  function startConnect(cert?: Certificate): Promise<void> {
    if (!connectPromise) {
      remote = remote ?? buildRemote(cert)
      const current = remote
      connectPromise = current.start().then(() => {}).finally(() => {
        if (remote === current)
          connectPromise = null
      })
    }
    return connectPromise
  }

  async function ensureConnected(): Promise<AndroidRemote> {
    if (state === 'unpaired')
      throw new Error(`Android TV "${name}" is not paired yet — call startPairing(), then submitPairingCode() with the PIN shown on the TV`)
    await startConnect(options.cert)
    if (!remote)
      throw new Error(`Android TV "${name}" lost its connection`)
    return remote
  }

  return {
    kind: 'tv',
    id,
    name,
    room,

    pairingState: () => state,

    async startPairing() {
      if (state === 'awaiting_code')
        return
      remote = null
      connectPromise = null
      const secretShown = new Promise<void>((resolve) => {
        const r = buildRemote()
        remote = r
        r.once('secret', () => resolve())
        r.once('ready', () => resolve())
      })
      void startConnect()
      await secretShown
    },

    submitPairingCode(code: string) {
      if (!remote || state !== 'awaiting_code')
        throw new Error('Pairing has not been started — call startPairing() first')
      remote.sendCode(code)
    },

    async getStatus(): Promise<TvStatus> {
      await ensureConnected()
      const media = await cast.getStatus().catch(() => ({ playback: 'idle' as const, volume: 0, muted: false, nowPlaying: undefined }))
      return { on: poweredOn, ...media }
    },

    async setOn(on: boolean) {
      const r = await ensureConnected()
      if (on !== poweredOn)
        r.sendPower()
    },

    setPlayback: cast.setPlayback,
    setVolume: cast.setVolume,
    setMuted: cast.setMuted,

    async sendRemoteKey(key: TvRemoteKey) {
      const r = await ensureConnected()
      const code = KEY_MAP[key]
      if (code === undefined)
        throw new Error(`Unsupported remote key: ${key}`)
      r.sendKey(code)
    },

    async launchApp(app: StreamingApp) {
      const r = await ensureConnected()
      const link = APP_LINKS[app]
      if (!link)
        throw new Error(`Unsupported app: ${app}`)
      r.sendAppLink(link)
    },
  }
}
