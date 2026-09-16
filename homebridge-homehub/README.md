# homebridge-homehub

A Homebridge platform plugin that talks directly to your Kasa/Tapo lights,
your Ecobee thermostat, and your August lock — bridging them into HomeKit
the normal Homebridge way, and also exposing a small local HTTP API that
the [HomeHub](../) dashboard polls and controls through.

It lives inside the HomeHub monorepo as its own self-contained package
(own `package.json`, build, lint, test) because it's a separate deployable:
it runs as a Homebridge plugin on whatever machine hosts your Homebridge
instance, not as part of the Next.js app.

## Honesty about API stability

- **Kasa (legacy protocol)** — a simple, long-stable, well-documented local
  protocol. High confidence.
- **Ecobee** — official, documented developer API. High confidence.
- **Tapo (`securePassthrough`)** — reverse-engineered, undocumented by
  TP-Link. Some newer Tapo firmware defaults to a different protocol
  ("KLAP") and needs **Secure Connect** turned on under the device's
  advanced settings in the Tapo app before this will work at all. Test
  against your actual hardware before relying on it.
- **August** — reverse-engineered, undocumented by August/Yale. Their
  backend has changed before (the "Yale Home" cloud migration broke older
  community clients). If this stops working, that's most likely why.

## Install

```bash
cd homebridge-homehub
npm install
npm run build
npm link
```

Then add a `HomeHubBridge` platform block to your Homebridge `config.json`
(or use Homebridge UI X's settings form, which reads `config.schema.json`
automatically once the plugin is linked).

## Setting up each device type

### Kasa / Tapo lights

Add each device's IP and protocol under `kasaDevices`. Kasa devices need
nothing else. Tapo devices need your Tapo account email/password (used
only for the device's *local* login, not a cloud call):

```json
{
  "kasaDevices": [
    { "name": "Living Room Lamp", "host": "192.168.1.42", "protocol": "kasa" },
    { "name": "Office Light", "host": "192.168.1.55", "protocol": "tapo", "tapoUsername": "you@example.com", "tapoPassword": "..." }
  ]
}
```

### Ecobee

1. Register a free app at the [Ecobee developer portal](https://www.ecobee.com/home/developer/api/) to get an API key.
2. Run the one-time PIN authorization from a Node REPL (or a small script) in this package:
   ```text
   import { exchangeEcobeePin, requestEcobeePin } from './dist/devices/ecobee.js'
   const { ecobeePin, code } = await requestEcobeePin('<your api key>')
   console.log(ecobeePin) // enter this at ecobee.com -> My Apps -> Add Application
   // after entering it on the ecobee website:
   const { refreshToken } = await exchangeEcobeePin('<your api key>', code)
   console.log(refreshToken)
   ```
3. Put `apiKey` and that `refreshToken` under `ecobee` in `config.json`. The plugin rotates and persists the refresh token itself from then on — you only do this once.

### August

August requires a one-time email verification per `installId`:

1. Leave `august.installId` unset on first run — the plugin generates one and saves it back to `config.json`, then logs a warning that verification is needed.
2. Trigger the emailed code and submit it once, from a Node REPL in this package:
   ```text
   import { requestAugustVerificationCode, submitAugustVerificationCode } from './dist/devices/august.js'
   await requestAugustVerificationCode('<installId from config.json>', 'you@example.com')
   // check your email for the code, then:
   // (accessToken here is whatever requestSession's x-august-access-token
   // header returned on the *unverified* session — see the module for how
   // createAugustLock surfaces that in its error message)
   await submitAugustVerificationCode('<installId>', '<accessToken>', 'you@example.com', '<code from email>')
   ```
3. Find your lock's id by calling `listAugustLocks(installId, email, password)` once verified, and put it in `august.lockId`.

## The HTTP API HomeHub talks to

Set `httpApi.token` to any random string (this is what you'll also paste
into HomeHub's Settings) and optionally `httpApi.port` (default `8582`).

- `GET /status` — `{ devices: [{ id, kind, name, ...state }] }` for every configured device.
- `POST /devices/:id/command` — body is whatever's changing, e.g. `{"on": true}`, `{"brightness": 80}`, `{"locked": true}`, `{"targetTemp": 72}`.

Both require `Authorization: Bearer <httpApi.token>`. This is meant to sit
on your local network next to Homebridge itself — same trust model as
Homebridge's own insecure mode, not something to expose to the internet
directly.

## Development

```bash
npm run lint      # eslint (flat config, @antfu/eslint-config)
npm run test      # vitest
npm run build     # tsc -> dist/
```
