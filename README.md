# HomeHub

A tile-first household dashboard: one glanceable screen for your calendars,
messages, Facebook Page activity, Spotify, notes, and stickers — built as a
real, live web app on Next.js 16 + Prisma/Postgres, with a Material 3
Expressive UI (Google Sans, Material Symbols, tonal color surfaces).

The app runs fully with no integrations connected — you'll just see empty
tiles and "not yet configured" badges until you wire up accounts from
**Settings**. Nothing is mocked: every tile calls a real provider API once
you connect it. It does need a real Postgres database, though — see below.

## What's here

- **Splash → setup wizard → dashboard** — first run walks through naming your
  household, connecting accounts, and choosing which tiles to show.
- **Dashboard tiles**: a calendar (Google / Microsoft / Apple) with Agenda,
  Week, Month, and Year views and full add/delete event support, recent
  messages (Slack / Teams), Facebook Page comments & Messenger activity plus
  Page insights, what's playing on Spotify (album art with a spinning-record
  overlay, tap to see more from that album), editable sticky notes, and a
  draggable emoji sticker board.
- A floating quick-add button on the dashboard for adding a note or sticker
  from anywhere, without scrolling to those tiles.
- **Customizable dashboard**: tap Customize to drag-reorder tiles and resize
  them (Compact/Standard/Wide/Large), with a spring-animated reflow as you
  go. The arrangement persists to the database. Live activity-based
  reordering (a busy tile temporarily growing/moving up) pauses while
  you're editing, so it doesn't fight your drag.
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
| Facebook Page | `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | developers.facebook.com/apps |
| Spotify | `SPOTIFY_CLIENT_ID` (PKCE, no secret) | developer.spotify.com/dashboard |
| Apple Calendar (iCloud) | Apple ID + app-specific password | Entered directly in Settings — no env vars |

Add the ones you have to `.env`, restart `npm run dev`, then go to
**Settings → Connected accounts** and click Connect. Every redirect URI is
`{APP_URL}/api/integrations/{provider}/callback`.

### Calendar: views + adding/deleting events

The calendar tile has four views (Agenda / Week / Month / Year) sharing one
fetch — switching views is instant, client-side filtering rather than a
refetch, with a spring-animated crossfade between them. Month/Year cells are
clickable to drill into that day or month.

The **+** button creates an event on whichever connected calendar account
you pick (Google, Microsoft, or Apple), and clicking any event opens a detail
sheet with a Delete button. This needed *write* scopes — `calendar.events`
for Google, `Calendars.ReadWrite` for Microsoft — broader than the
read-only scopes this app originally requested. **If you connected Google
or Microsoft Calendar before this feature shipped, disconnect and reconnect
it in Settings** — a stored OAuth token only carries the scopes it was
granted at the time, so an old connection can display events but will fail
to create/delete them until you reconnect. Apple Calendar's CalDAV
credentials already had write access, so no reconnect is needed there.

A known simplification: events are grouped by their *start* day only, so a
multi-day event shows on the day it starts, not on every day it spans.

A couple of honest platform limits, so the tiles don't over-promise:

- **Facebook Page, not personal profile**: connecting Facebook exchanges your
  login for a *Page* access token (via the admin account you connect with),
  not your personal profile's. It syncs the Page's own comments, Messenger
  conversations, and insights — not your friends' activity.
- **Teams messages**: reading chat via Microsoft Graph needs the `Chat.Read`
  scope, which many organizational tenants gate behind admin consent. The
  Messages tile degrades gracefully (just shows nothing from that source)
  rather than erroring if it isn't granted.
- **Spotify in-app playback needs Premium**: the widget can register this
  browser tab as a Spotify Connect device (Spotify's Web Playback SDK) and
  play/pause/skip/seek right on the dashboard via the **Play here** button.
  That only works for Premium accounts — a Free account can still connect
  and see what's currently (or most recently) playing, with tracks linking
  out to open in Spotify, but the SDK refuses to actually play audio for it.

### Spotify: in-app playback

Playing music directly on the dashboard (rather than just showing what's
playing) needs the `streaming` and `user-modify-playback-state` scopes,
added on top of the original read-only ones, plus the Web Playback SDK
enabled for your app (Settings → APIs used, in the Spotify Developer
Dashboard). **If you connected Spotify before this shipped, disconnect and
reconnect it in Settings** — same reason as the calendar scopes above, a
stored token only carries what it was granted at connect time.

Once reconnected, a **Play here** pill appears under the track info whenever
Spotify is connected; tapping it transfers active playback to this browser
tab and shows a small transport (progress bar, previous/play-pause/next).
It stays in sync with real Spotify Connect state — switching devices from
your phone or another app hands control back automatically, since the
widget just reflects whatever the Web Playback SDK reports for this
device.

## Tech

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
Prisma 7 + `pg` driver adapter (Postgres) · framer-motion · SWR for live
polling. Material 3 Expressive design system: Google Sans (via `next/font`),
a self-hosted Material Symbols Rounded icon font (`public/fonts`, ligature
glyphs rendered through `src/components/Icon.tsx`), and M3 tonal color
roles/elevation in `src/app/globals.css`.

## Project structure

- `src/app` — pages (`/`, `/setup`, `/dashboard`, `/settings`) and API routes
  under `src/app/api`.
- `src/lib/integrations` — the provider registry, OAuth exchange/refresh
  logic, and the live data fetchers for each service.
- `src/lib/crypto.ts` — token encryption at rest.
- `src/components` — UI, including the shared `IntegrationsPanel` used by
  both the setup wizard and Settings, and `dashboard/calendar/` for the
  Agenda/Week/Month/Year views plus the new/delete-event UI.
- `prisma/schema.prisma` — data model (Household, Integration, Note, Sticker,
  TilePreference).
