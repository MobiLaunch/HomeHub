import type { AndroidRemote, AndroidRemoteOptions, Certificate } from '@kud/androidtv-remote'
import type { Client } from 'castv2-client'
import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { createAndroidTv } from './androidtv.js'

class FakeAndroidRemote extends EventEmitter implements AndroidRemote {
  started = false
  poweredState = false
  sentKeys: number[] = []
  sentAppLinks: string[] = []
  cert: Certificate = { key: 'fake-key', cert: 'fake-cert' }

  constructor(public host: string, public options: AndroidRemoteOptions = {}) {
    super()
  }

  async start(): Promise<boolean> {
    this.started = true
    if (this.options.cert) {
      queueMicrotask(() => this.emit('ready'))
    }
    else {
      queueMicrotask(() => this.emit('secret'))
    }
    return true
  }

  sendCode(_code: string): boolean {
    this.emit('ready')
    return true
  }

  sendPower(): void {
    this.poweredState = !this.poweredState
    this.emit('powered', this.poweredState)
  }

  sendKey(keyCode: number): void {
    this.sentKeys.push(keyCode)
  }

  sendAppLink(link: string): void {
    this.sentAppLinks.push(link)
  }

  sendText(_text: string): void {}
  getCertificate(): Certificate {
    return this.cert
  }

  stop(): void {}
}

class FakeCastClient extends EventEmitter {
  volume = { level: 0.3, muted: false }
  connect(_options: unknown, callback: () => void): void {
    queueMicrotask(callback)
  }

  close(): void {}
  getStatus(callback: (error: Error | null, status: { applications?: never[], volume: typeof this.volume }) => void): void {
    callback(null, { applications: [], volume: this.volume })
  }

  setVolume(options: { level?: number, muted?: boolean }, callback?: (error: Error | null, volume: typeof this.volume) => void): void {
    if (options.level !== undefined)
      this.volume.level = options.level
    callback?.(null, this.volume)
  }
}

function factories() {
  let lastRemote: FakeAndroidRemote | null = null
  const remoteFactory = vi.fn((host: string, options?: AndroidRemoteOptions) => {
    lastRemote = new FakeAndroidRemote(host, options)
    return lastRemote
  })
  const castClientFactory = () => new FakeCastClient() as unknown as Client
  return { remoteFactory, castClientFactory, getLastRemote: () => lastRemote! }
}

describe('createAndroidTv', () => {
  it('starts unpaired when no certificate is configured', () => {
    const { remoteFactory, castClientFactory } = factories()
    const tv = createAndroidTv('tv-1', 'Living Room TV', '192.168.1.20', { remoteFactory, castClientFactory })
    expect(tv.pairingState()).toBe('unpaired')
  })

  it('starts paired when a saved certificate is configured', () => {
    const { remoteFactory, castClientFactory } = factories()
    const tv = createAndroidTv('tv-1', 'Living Room TV', '192.168.1.20', { cert: { key: 'k', cert: 'c' }, remoteFactory, castClientFactory })
    expect(tv.pairingState()).toBe('paired')
  })

  it('rejects control calls before pairing', async () => {
    const { remoteFactory, castClientFactory } = factories()
    const tv = createAndroidTv('tv-1', 'Living Room TV', '192.168.1.20', { remoteFactory, castClientFactory })
    await expect(tv.getStatus()).rejects.toThrow(/not paired/)
  })

  it('moves to awaiting_code once pairing starts, then paired once the code is submitted', async () => {
    const { remoteFactory, castClientFactory, getLastRemote } = factories()
    const tv = createAndroidTv('tv-1', 'Living Room TV', '192.168.1.20', { remoteFactory, castClientFactory })

    await tv.startPairing()
    expect(tv.pairingState()).toBe('awaiting_code')

    const ready = new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (tv.pairingState() === 'paired') {
          clearInterval(check)
          resolve()
        }
      }, 1)
    })
    tv.submitPairingCode('123456')
    await ready
    expect(tv.pairingState()).toBe('paired')
    expect(getLastRemote().sentKeys).toEqual([])
  })

  it('persists the certificate once paired', async () => {
    const { remoteFactory, castClientFactory } = factories()
    const onCertificate = vi.fn()
    const tv = createAndroidTv('tv-1', 'Living Room TV', '192.168.1.20', { remoteFactory, castClientFactory, onCertificate })

    await tv.startPairing()
    await new Promise<void>((resolve) => {
      tv.submitPairingCode('123456')
      setTimeout(resolve, 5)
    })

    expect(onCertificate).toHaveBeenCalledWith({ key: 'fake-key', cert: 'fake-cert' })
  })

  it('toggles power only when the target state differs from the current one', async () => {
    const { remoteFactory, castClientFactory, getLastRemote } = factories()
    const tv = createAndroidTv('tv-1', 'Living Room TV', '192.168.1.20', { cert: { key: 'k', cert: 'c' }, remoteFactory, castClientFactory })

    await tv.setOn(true)
    expect(getLastRemote().poweredState).toBe(true)

    await tv.setOn(true)
    expect(getLastRemote().poweredState).toBe(true) // unchanged — no second toggle
  })

  it('sends the mapped key code for a remote key', async () => {
    const { remoteFactory, castClientFactory, getLastRemote } = factories()
    const tv = createAndroidTv('tv-1', 'Living Room TV', '192.168.1.20', { cert: { key: 'k', cert: 'c' }, remoteFactory, castClientFactory })

    await tv.sendRemoteKey('select')
    expect(getLastRemote().sentKeys).toHaveLength(1)
  })

  it('reports device volume from the cast controller alongside power state', async () => {
    const { remoteFactory, castClientFactory } = factories()
    const tv = createAndroidTv('tv-1', 'Living Room TV', '192.168.1.20', { cert: { key: 'k', cert: 'c' }, remoteFactory, castClientFactory })

    await expect(tv.getStatus()).resolves.toMatchObject({ on: false, volume: 30, playback: 'idle' })
  })

  it('launches a streaming app via its registered deep link', async () => {
    const { remoteFactory, castClientFactory, getLastRemote } = factories()
    const tv = createAndroidTv('tv-1', 'Living Room TV', '192.168.1.20', { cert: { key: 'k', cert: 'c' }, remoteFactory, castClientFactory })

    await tv.launchApp('netflix')
    expect(getLastRemote().sentAppLinks).toEqual(['https://www.netflix.com'])
  })
})
