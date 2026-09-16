import type { API } from 'homebridge'
import { readFileSync, writeFileSync } from 'node:fs'

/**
 * A few of our credentials rotate or get generated at runtime (ecobee's
 * refresh token, August's installId) and need to survive a Homebridge
 * restart. Homebridge's plugin API doesn't hand out a "save config"
 * helper, so — like several real-world plugins that manage their own
 * OAuth tokens — this reads/patches/writes config.json directly via the
 * documented `api.user.configPath()` path.
 */
export function updatePlatformConfig(api: API, platformName: string, patch: (config: Record<string, unknown>) => void): void {
  const configPath = api.user.configPath()
  const raw = JSON.parse(readFileSync(configPath, 'utf8')) as { platforms?: Array<Record<string, unknown>> }
  const platform = raw.platforms?.find(p => p.platform === platformName)
  if (!platform)
    return
  patch(platform)
  writeFileSync(configPath, JSON.stringify(raw, null, 4))
}
