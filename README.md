# HomeHub

A tile-first household dashboard: one glanceable screen for your calendars,
messages, birthdays, notes, and stickers — built as a real, live web app on
Next.js 16 + Prisma/Postgres, with a "liquid glass" translucent UI.

The app runs fully with no integrations connected — you'll just see empty
tiles and "not yet configured" badges until you wire up accounts from
**Settings**. Nothing is mocked: every tile calls a real provider API once
you connect it. It does need a real Postgres database, though — see below.

## What's here

- **Splash → setup wizard → dashboard** — first run walks through naming your
  household, connecting accounts, and choosing which tiles to show.
- **Dashboard tiles**: upcoming calendar events (Google / Microsoft / Apple),
  recent messages (Slack / Teams), birthday & social notifications (Facebook),
  sticky notes, and a draggable emoji sticker board.
- **Settings panel** to connect/disconnect every integration, toggle tiles,
  edit household name/timezone, and switch light/dark/system appearance.
- OAuth tokens (and the Apple app-specific password) are encrypted at rest
  with AES-256-GCM before being written to the database.

## Getting started

You need a Postgres database — any Postgres works (local, Neon, Supabase,
Railway, Vercel Postgres). SQLite deliberately isn't supported: it doesn't
survive on serverless hosts like Vercel (no persistent disk between
invocations), which is exactly the bug that made this app's own Settings
page hang forever until this got fixed.

```bash
npm install
cp .env.example .env
# generate a real key and paste it into ENCRYPTION_KEY in .env:
openssl rand -base64 32
# paste a Postgres connection string into DATABASE_URL in .env, then:
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on the setup
wizard on first run; after that the splash screen routes straight to the
dashboard.

### Deploying on Vercel

1. Project → Storage → Create Database → Postgres. This auto-injects the
   connection env vars for you — make sure one of them is (or is copied
   into) `DATABASE_URL`, since that's what Prisma reads.
2. Add `ENCRYPTION_KEY` and `APP_URL` (your deployed domain) in Project →
   Settings → Environment Variables.
3. **Apply the schema to that database once, from your own machine**, with
   `DATABASE_URL` pointed at it:
   ```bash
   DATABASE_URL="<paste the connection string>" npm run migrate:prod
   ```
   This is deliberately *not* run as part of the Vercel build. Vercel
   env vars default to "Sensitive," which are only decrypted for the app at
   runtime — the build container never sees them — so a build step that
   needs `DATABASE_URL` (like `prisma migrate deploy`) fails with
   `Connection url is empty` even though the variable is set correctly.
   Run `npm run migrate:prod` again any time `prisma/schema.prisma` changes.
4. Deploy (`npm run vercel-build` just generates the Prisma client and runs
   `next build` — no database access needed at build time at all).

## Connecting real accounts

Everything works with zero integrations connected — you're just wiring up
"data lines" as you get to them. Each provider needs its own OAuth app
credentials except Apple, which connects with an app-specific password.
**`.env.example` has copy-paste setup steps for every provider** (Google
Cloud Console, Azure App registrations, Slack app, Meta developer app). In
short:

| Provider | What it needs | Where to get it |
| --- | --- | --- |
| Google Calendar | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth client |
| Microsoft 365 (Outlook + Teams) | `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Azure Entra ID → App registration |
| Slack | `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | api.slack.com/apps |
| Facebook | `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | developers.facebook.com/apps |
| Apple Calendar (iCloud) | Apple ID + app-specific password | Entered directly in Settings — no env vars |

Add the ones you have to `.env`, restart `npm run dev`, then go to
**Settings → Connected accounts** and click Connect. Every redirect URI is
`{APP_URL}/api/integrations/{provider}/callback`.

A couple of honest platform limits, so the tiles don't over-promise:

- **Facebook birthdays**: Meta stopped letting third-party apps read a
  friend list's birthdays back in 2018. This tile can only ever show the
  connected account's *own* birthday reminder, not friends'.
- **Teams messages**: reading chat via Microsoft Graph needs the `Chat.Read`
  scope, which many organizational tenants gate behind admin consent. The
  Messages tile degrades gracefully (just shows nothing from that source)
  rather than erroring if it isn't granted.

## Tech

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
Prisma 7 + `pg` driver adapter (Postgres) · framer-motion · SWR for live
polling.

## Project structure

- `src/app` — pages (`/`, `/setup`, `/dashboard`, `/settings`) and API routes
  under `src/app/api`.
- `src/lib/integrations` — the provider registry, OAuth exchange/refresh
  logic, and the live data fetchers for each service.
- `src/lib/crypto.ts` — token encryption at rest.
- `src/components` — UI, including the shared `IntegrationsPanel` used by
  both the setup wizard and Settings.
- `prisma/schema.prisma` — data model (Household, Integration, Note, Sticker,
  TilePreference).
