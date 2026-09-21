# homebridge-homehub

A Homebridge platform plugin that talks directly to your Kasa/Tapo lights,
your Ecobee thermostat, your August lock, your Google Home/Cast speakers,
and your Android TV / Google TV — bridging them into HomeKit the normal
Homebridge way, and also exposing a small local HTTP API that the
[HomeHub](../) dashboard polls and controls through.

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
- **Google Cast (speakers, and TV media/volume)** — unofficial (Google
  publishes no public API), but this is the same stable local protocol
  every Cast-enabled speaker and every Google TV's Cast receiver has spoken
  for years. High confidence.
- **Android TV Remote v2 (TV power/navigation)** — also unofficial, and a
  newer/less battle-tested implementation than the others here. Real
  remote-control-style commands only; media state comes from Cast instead
  (see above), since this protocol only reports a foreground app name.
  App shortcuts (`launchApp`) go through the same protocol via a deep
  link — works when the app is installed and has registered that link,
  which is true of the major streaming apps on stock Google TV (e.g. a
  Walmart onn. streaming device), but a heavily customized manufacturer
  build could behave differently. Not yet verified against real hardware.

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

### Google Home / Cast speakers

No pairing needed — Cast accepts local connections by design. Just add
each speaker's IP under `googleCastSpeakers`:

```json
{
  "googleCastSpeakers": [
    { "name": "Kitchen Speaker", "host": "192.168.1.60", "room": "Kitchen" }
  ]
}
```

Volume/mute always work. Play/pause and "now playing" only work while
something is actively casting to the speaker — there's nothing to control
otherwise, and `GET /status` reports `playback: "idle"` with no
`nowPlaying` in that case.

### Android TV / Google TV

Requires a one-time on-screen PIN pairing per TV (the TV shows a PIN the
first time it's approached, the same shape as Ecobee's PIN flow above):

1. Add the TV under `androidTvs` with just `name` and `host` — leave `cert` unset.
2. Start Homebridge. It'll log a warning that this TV needs pairing.
3. From HomeHub's dashboard (or directly): `POST /devices/androidtv-<host>/pair` — the TV will show a PIN on screen.
4. `POST /devices/androidtv-<host>/pair/code` with body `{"code": "<PIN from the TV>"}`.
5. The plugin saves the resulting certificate back into `config.json` under that TV's `cert` — pairing is a one-time step from then on.

Power and D-pad/media-key navigation go over Android TV Remote v2.
Play/pause/volume/mute/now-playing go over the TV's Cast receiver instead
(same as a speaker) — see the confidence note above for why.

## The HTTP API HomeHub talks to

Set `httpApi.token` to any random string (this is what you'll also paste
into HomeHub's Settings) and optionally `httpApi.port` (default `8582`).

- `GET /status` — `{ devices: [{ id, kind, name, ...state }] }` for every configured device. An unpaired Android TV reports `{ id, kind, name, pairingState }` instead of live state.
- `POST /devices/:id/command` — body is whatever's changing:
  - light: `{"on": true}`, `{"brightness": 80}`
  - lock: `{"locked": true}`
  - climate: `{"targetTemp": 72}`
  - speaker: `{"playback": "playing" | "paused"}`, `{"volume": 50}`, `{"muted": true}`
  - tv: all of the speaker commands, plus `{"on": true}`, `{"remoteKey": "up" | "down" | "left" | "right" | "select" | "back" | "exit" | "play_pause" | "rewind" | "fast_forward" | "next_track" | "previous_track" | "information"}`, and `{"launchApp": "netflix" | "youtube" | "disney_plus" | "hulu" | "prime_video" | "max" | "apple_tv" | "spotify"}`
- `POST /devices/:id/pair` / `POST /devices/:id/pair/code` — Android TV's one-time PIN pairing (see above). No other device kind has these routes.

All require `Authorization: Bearer <httpApi.token>`. This is meant to sit
on your local network next to Homebridge itself — same trust model as
Homebridge's own insecure mode, not something to expose to the internet
directly.

## Development

```bash
npm run lint      # eslint (flat config, @antfu/eslint-config)
npm run test      # vitest
npm run build     # tsc -> dist/
```
