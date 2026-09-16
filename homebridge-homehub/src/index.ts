import type { API } from 'homebridge'
import { HomeHubBridgePlatform, PLATFORM_NAME } from './platform.js'

export default (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, HomeHubBridgePlatform)
}
