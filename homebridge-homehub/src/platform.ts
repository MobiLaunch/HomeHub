import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge'
import type { HomeHubBridgeConfig } from './config.js'
import type { ClimateDevice, Device, LightDevice, LockDevice, PlaybackState, SpeakerDevice, TvDevice, TvRemoteKey } from './devices/types.js'
import { isHomeHubBridgeConfig } from './config.js'
import { updatePlatformConfig } from './configStore.js'
import { createAndroidTv } from './devices/androidtv.js'
import { createAugustLock, generateAugustInstallId } from './devices/august.js'
import { createEcobeeThermostat } from './devices/ecobee.js'
import { createGoogleCastSpeaker } from './devices/googlecast.js'
import { createKasaLight } from './devices/kasa.js'
import { createTapoLight } from './devices/tapo.js'
import { startHttpApi } from './httpApi.js'

export const PLATFORM_NAME = 'HomeHubBridge'
export const PLUGIN_NAME = 'homebridge-homehub'

export class HomeHubBridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service
  public readonly Characteristic: typeof Characteristic
  public readonly accessories: PlatformAccessory[] = []
  private readonly devices: Device[] = []

  constructor(
    private readonly log: Logging,
    private readonly config: PlatformConfig,
    private readonly api: API,
  ) {
    this.Service = api.hap.Service
    this.Characteristic = api.hap.Characteristic

    if (!isHomeHubBridgeConfig(config)) {
      this.log.error('HomeHubBridge config is missing httpApi.token — plugin disabled')
      return
    }

    api.on('didFinishLaunching', () => {
      this.discoverDevices(config)
        .then(() => {
          const server = startHttpApi(this.log, config.httpApi, this.devices)
          api.on('shutdown', () => server.close())
        })
        .catch((error: unknown) => this.log.error('Failed to set up HomeHub Bridge devices:', error))
    })
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.accessories.push(accessory)
  }

  private getOrCreateAccessory(id: string, name: string): PlatformAccessory {
    const uuid = this.api.hap.uuid.generate(id)
    const existing = this.accessories.find(a => a.UUID === uuid)
    if (existing)
      return existing
    // eslint-disable-next-line new-cap -- this is Homebridge's own documented API shape (api.platformAccessory is a class, just camelCased)
    const accessory = new this.api.platformAccessory(name, uuid)
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
    return accessory
  }

  private async discoverDevices(config: HomeHubBridgeConfig): Promise<void> {
    for (const kasaConfig of config.kasaDevices ?? []) {
      const id = `kasa-${kasaConfig.host}`
      const device
        = kasaConfig.protocol === 'tapo'
          ? createTapoLight(id, kasaConfig.name, kasaConfig.host, kasaConfig.tapoUsername ?? '', kasaConfig.tapoPassword ?? '', kasaConfig.room)
          : createKasaLight(id, kasaConfig.name, kasaConfig.host, { room: kasaConfig.room })
      this.devices.push(device)
      this.setupLightAccessory(device)
    }

    if (config.ecobee?.apiKey && config.ecobee.refreshToken) {
      const thermostat = createEcobeeThermostat(config.ecobee.apiKey, config.ecobee.refreshToken, (refreshToken) => {
        updatePlatformConfig(this.api, PLATFORM_NAME, (platformConfig) => {
          (platformConfig.ecobee as Record<string, unknown>).refreshToken = refreshToken
        })
      }, config.ecobee.room)
      this.devices.push(thermostat)
      this.setupClimateAccessory(thermostat)
    }

    if (config.august?.email && config.august.password) {
      let installId = config.august.installId
      if (!installId) {
        installId = generateAugustInstallId()
        updatePlatformConfig(this.api, PLATFORM_NAME, (platformConfig) => {
          (platformConfig.august as Record<string, unknown>).installId = installId
        })
        this.log.warn(
          `Generated a new August installId — this account still needs one-time verification. See the plugin README for the requestAugustVerificationCode/submitAugustVerificationCode steps.`,
        )
      }
      // August has no "list all locks" call that works before verification,
      // so a single lock's id must be supplied once it's known; until then
      // we can't register a HomeKit accessory for it yet.
      if (config.august.lockId) {
        const lock = createAugustLock(config.august.lockId, config.august.lockName ?? 'Front Door', installId, config.august.email, config.august.password, config.august.room)
        this.devices.push(lock)
        this.setupLockAccessory(lock)
      }
      else {
        this.log.warn('august.lockId not set yet — call listAugustLocks once verified, then add the id to config.json')
      }
    }

    for (const speakerConfig of config.googleCastSpeakers ?? []) {
      const id = `cast-${speakerConfig.host}`
      const speaker = createGoogleCastSpeaker(id, speakerConfig.name, speakerConfig.host, speakerConfig.room)
      this.devices.push(speaker)
      this.setupSpeakerAccessory(speaker)
    }

    config.androidTvs?.forEach((tvConfig, index) => {
      const id = `androidtv-${tvConfig.host}`
      const tv = createAndroidTv(id, tvConfig.name, tvConfig.host, {
        cert: tvConfig.cert,
        onCertificate: (cert) => {
          updatePlatformConfig(this.api, PLATFORM_NAME, (platformConfig) => {
            const tvs = platformConfig.androidTvs as Array<Record<string, unknown>> | undefined
            if (tvs?.[index])
              tvs[index].cert = cert
          })
        },
      }, tvConfig.room)
      this.devices.push(tv)
      this.setupTvAccessory(tv)
      if (!tvConfig.cert) {
        this.log.warn(
          `Android TV "${tvConfig.name}" has no saved pairing certificate yet — pair it once via the HomeHub dashboard (or POST /devices/${id}/pair then /devices/${id}/pair/code, see README).`,
        )
      }
    })

    this.log.info(`HomeHub Bridge ready with ${this.devices.length} device(s)`)
  }

  private setupLightAccessory(device: LightDevice): void {
    const accessory = this.getOrCreateAccessory(device.id, device.name)
    const service = accessory.getService(this.Service.Lightbulb) ?? accessory.addService(this.Service.Lightbulb)
    service.setCharacteristic(this.Characteristic.Name, device.name)
    service.getCharacteristic(this.Characteristic.On)
      .onGet(async () => (await device.getStatus()).on)
      .onSet(async value => device.setOn(Boolean(value)))
    service.getCharacteristic(this.Characteristic.Brightness)
      .onGet(async () => (await device.getStatus()).brightness)
      .onSet(async value => device.setBrightness(Number(value)))
  }

  private setupLockAccessory(device: LockDevice): void {
    const accessory = this.getOrCreateAccessory(device.id, device.name)
    const service = accessory.getService(this.Service.LockMechanism) ?? accessory.addService(this.Service.LockMechanism)
    service.setCharacteristic(this.Characteristic.Name, device.name)
    const toHapState = (locked: boolean): number =>
      locked ? this.Characteristic.LockCurrentState.SECURED : this.Characteristic.LockCurrentState.UNSECURED
    service.getCharacteristic(this.Characteristic.LockCurrentState)
      .onGet(async () => toHapState((await device.getStatus()).locked))
    service.getCharacteristic(this.Characteristic.LockTargetState)
      .onGet(async () => toHapState((await device.getStatus()).locked))
      .onSet(async (value) => {
        const locked = value === this.Characteristic.LockTargetState.SECURED
        await device.setLocked(locked)
        service.updateCharacteristic(this.Characteristic.LockCurrentState, toHapState(locked))
      })
  }

  private setupClimateAccessory(device: ClimateDevice): void {
    const accessory = this.getOrCreateAccessory(device.id, device.name)
    const service = accessory.getService(this.Service.Thermostat) ?? accessory.addService(this.Service.Thermostat)
    service.setCharacteristic(this.Characteristic.Name, device.name)
    service.getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(async () => fahrenheitToCelsius((await device.getStatus()).currentTemp))
    service.getCharacteristic(this.Characteristic.TargetTemperature)
      .onGet(async () => fahrenheitToCelsius((await device.getStatus()).targetTemp))
      .onSet(async value => device.setTargetTemp(celsiusToFahrenheit(Number(value))))
  }

  private setupSpeakerAccessory(device: SpeakerDevice): void {
    const accessory = this.getOrCreateAccessory(device.id, device.name)
    const service = accessory.getService(this.Service.SmartSpeaker) ?? accessory.addService(this.Service.SmartSpeaker)
    service.setCharacteristic(this.Characteristic.Name, device.name)
    service.getCharacteristic(this.Characteristic.CurrentMediaState)
      .onGet(async () => toMediaState(this.Characteristic, (await device.getStatus()).playback))
    service.getCharacteristic(this.Characteristic.TargetMediaState)
      .onGet(async () => toMediaState(this.Characteristic, (await device.getStatus()).playback))
      .onSet(async (value) => {
        if (value === this.Characteristic.TargetMediaState.PLAY)
          await device.setPlayback('playing')
        else if (value === this.Characteristic.TargetMediaState.PAUSE)
          await device.setPlayback('paused')
      })
    service.getCharacteristic(this.Characteristic.Mute)
      .onGet(async () => (await device.getStatus()).muted)
      .onSet(async value => device.setMuted(Boolean(value)))
    service.getCharacteristic(this.Characteristic.Volume)
      .onGet(async () => (await device.getStatus()).volume)
      .onSet(async value => device.setVolume(Number(value)))
  }

  private setupTvAccessory(device: TvDevice): void {
    const accessory = this.getOrCreateAccessory(device.id, device.name)
    const service = accessory.getService(this.Service.Television) ?? accessory.addService(this.Service.Television)
    service.setCharacteristic(this.Characteristic.Name, device.name)
    service.setCharacteristic(this.Characteristic.ConfiguredName, device.name)
    service.setCharacteristic(this.Characteristic.SleepDiscoveryMode, this.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE)
    service.getCharacteristic(this.Characteristic.Active)
      .onGet(async () => ((await device.getStatus()).on ? this.Characteristic.Active.ACTIVE : this.Characteristic.Active.INACTIVE))
      .onSet(async value => device.setOn(value === this.Characteristic.Active.ACTIVE))
    // Single-input device — HomeKit still requires an Active Identifier.
    service.setCharacteristic(this.Characteristic.ActiveIdentifier, 1)
    service.getCharacteristic(this.Characteristic.RemoteKey)
      .onSet(async (value) => {
        const key = fromRemoteKey(this.Characteristic, Number(value))
        if (key)
          await device.sendRemoteKey(key)
      })

    const speakerService = accessory.getService(this.Service.TelevisionSpeaker) ?? accessory.addService(this.Service.TelevisionSpeaker)
    speakerService.setCharacteristic(this.Characteristic.Name, `${device.name} Volume`)
    speakerService.setCharacteristic(this.Characteristic.VolumeControlType, this.Characteristic.VolumeControlType.ABSOLUTE)
    speakerService.getCharacteristic(this.Characteristic.Mute)
      .onGet(async () => (await device.getStatus()).muted)
      .onSet(async value => device.setMuted(Boolean(value)))
    speakerService.getCharacteristic(this.Characteristic.Volume)
      .onGet(async () => (await device.getStatus()).volume)
      .onSet(async value => device.setVolume(Number(value)))
    service.addLinkedService(speakerService)
  }
}

function toMediaState(Characteristic: typeof import('homebridge').Characteristic, playback: PlaybackState): number {
  if (playback === 'playing')
    return Characteristic.CurrentMediaState.PLAY
  if (playback === 'paused')
    return Characteristic.CurrentMediaState.PAUSE
  return Characteristic.CurrentMediaState.STOP
}

function fromRemoteKey(Characteristic: typeof import('homebridge').Characteristic, value: number): TvRemoteKey | null {
  const map: Record<number, TvRemoteKey> = {
    [Characteristic.RemoteKey.REWIND]: 'rewind',
    [Characteristic.RemoteKey.FAST_FORWARD]: 'fast_forward',
    [Characteristic.RemoteKey.NEXT_TRACK]: 'next_track',
    [Characteristic.RemoteKey.PREVIOUS_TRACK]: 'previous_track',
    [Characteristic.RemoteKey.ARROW_UP]: 'up',
    [Characteristic.RemoteKey.ARROW_DOWN]: 'down',
    [Characteristic.RemoteKey.ARROW_LEFT]: 'left',
    [Characteristic.RemoteKey.ARROW_RIGHT]: 'right',
    [Characteristic.RemoteKey.SELECT]: 'select',
    [Characteristic.RemoteKey.BACK]: 'back',
    [Characteristic.RemoteKey.EXIT]: 'exit',
    [Characteristic.RemoteKey.PLAY_PAUSE]: 'play_pause',
    [Characteristic.RemoteKey.INFORMATION]: 'information',
  }
  return map[value] ?? null
}

// HomeKit's Thermostat service always speaks Celsius over HAP regardless of
// the user's display unit — our device layer stays in Fahrenheit since
// that's what Ecobee's API (and US users) actually use.
function fahrenheitToCelsius(f: number): number {
  return Math.round(((f - 32) * (5 / 9)) * 10) / 10
}
function celsiusToFahrenheit(c: number): number {
  return Math.round((c * (9 / 5) + 32) * 10) / 10
}
