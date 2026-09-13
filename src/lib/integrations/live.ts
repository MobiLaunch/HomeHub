import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { getValidAccessToken } from "./tokens";
import { DAVClient } from "tsdav";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end: string | null;
  allDay: boolean;
  location: string | null;
  source: "google" | "microsoft" | "apple";
  accountLabel: string;
};

export type LiveMessage = {
  id: string;
  text: string;
  author: string;
  channel: string;
  timestamp: string; // ISO
  source: "slack" | "microsoft";
  accountLabel: string;
};

export type FacebookActivityItem = {
  id: string;
  kind: "comment" | "message";
  authorName: string;
  text: string;
  postMessage: string | null; // parent post text, for a comment item
  timestamp: string; // ISO
  permalink: string | null;
  accountLabel: string;
};

export type FacebookPageInsights = {
  pageId: string;
  pageName: string;
  followers: number | null;
  impressions28d: number | null;
  engagedUsers28d: number | null;
  newFollowers28d: number | null;
  accountLabel: string;
};

export type SpotifyTrack = {
  id: string;
  name: string;
  artists: string;
  albumId: string;
  albumName: string;
  albumArtUrl: string | null;
  durationMs: number;
  externalUrl: string;
};

export type SpotifyNowPlaying = {
  isPlaying: boolean;
  progressMs: number | null;
  track: SpotifyTrack;
  albumTracks: SpotifyTrack[];
  accountLabel: string;
};

async function markSynced(integrationId: string, error?: string) {
  await db.integration.update({
    where: { id: integrationId },
    data: {
      lastSyncedAt: new Date(),
      lastError: error ?? null,
      status: error ? "error" : "connected",
    },
  });
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const integrations = await db.integration.findMany({
    where: {
      provider: { in: ["google", "microsoft", "apple"] },
      status: { in: ["connected", "error"] },
    },
  });

  const results = await Promise.all(
    integrations.map(async (integration) => {
      try {
        if (integration.provider === "google") {
          const token = await getValidAccessToken(integration);
          if (!token) return [];
          const events = await fetchGoogleCalendarEvents(token);
          await markSynced(integration.id);
          return events.map((e) => ({ ...e, accountLabel: integration.label }));
        }
        if (integration.provider === "microsoft") {
          const token = await getValidAccessToken(integration);
          if (!token) return [];
          const events = await fetchMicrosoftCalendarEvents(token);
          await markSynced(integration.id);
          return events.map((e) => ({ ...e, accountLabel: integration.label }));
        }
        if (integration.provider === "apple") {
          if (!integration.credentialUsername || !integration.credentialSecretEnc) return [];
          const password = decryptSecret(integration.credentialSecretEnc);
          const events = await fetchAppleCalendarEvents(
            integration.credentialUsername,
            password,
          );
          await markSynced(integration.id);
          return events.map((e) => ({ ...e, accountLabel: integration.label }));
        }
        return [];
      } catch (err) {
        await markSynced(integration.id, (err as Error).message);
        return [];
      }
    }),
  );

  return results.flat().sort((a, b) => a.start.localeCompare(b.start));
}

export async function fetchLiveMessages(): Promise<LiveMessage[]> {
  const integrations = await db.integration.findMany({
    where: { provider: { in: ["slack", "microsoft"] }, status: { in: ["connected", "error"] } },
  });

  const results = await Promise.all(
    integrations.map(async (integration) => {
      try {
        const token = await getValidAccessToken(integration);
        if (!token) return [];
        if (integration.provider === "slack") {
          const messages = await fetchSlackMessages(token);
          await markSynced(integration.id);
          return messages.map((m) => ({ ...m, accountLabel: integration.label }));
        }
        if (integration.provider === "microsoft") {
          const messages = await fetchMicrosoftChatMessages(token);
          await markSynced(integration.id);
          return messages.map((m) => ({ ...m, accountLabel: integration.label }));
        }
        return [];
      } catch (err) {
        await markSynced(integration.id, (err as Error).message);
        return [];
      }
    }),
  );

  return results
    .flat()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 25);
}

export async function fetchFacebookActivity(): Promise<FacebookActivityItem[]> {
  const integrations = await db.integration.findMany({
    where: { provider: "facebook", status: { in: ["connected", "error"] } },
  });

  const results = await Promise.all(
    integrations.map(async (integration) => {
      try {
        const token = await getValidAccessToken(integration);
        if (!token || !integration.externalAccountId) return [];
        const [comments, messages] = await Promise.all([
          fetchFacebookPageComments(integration.externalAccountId, token),
          fetchFacebookPageMessages(integration.externalAccountId, token),
        ]);
        await markSynced(integration.id);
        return [...comments, ...messages].map((item) => ({
          ...item,
          accountLabel: integration.label,
        }));
      } catch (err) {
        await markSynced(integration.id, (err as Error).message);
        return [];
      }
    }),
  );

  return results.flat().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function fetchFacebookInsights(): Promise<FacebookPageInsights[]> {
  const integrations = await db.integration.findMany({
    where: { provider: "facebook", status: { in: ["connected", "error"] } },
  });

  const results = await Promise.all(
    integrations.map(async (integration) => {
      try {
        const token = await getValidAccessToken(integration);
        if (!token || !integration.externalAccountId) return null;
        const insights = await fetchFacebookPageInsights(integration.externalAccountId, token);
        await markSynced(integration.id);
        return { ...insights, pageName: integration.label, accountLabel: integration.label };
      } catch (err) {
        await markSynced(integration.id, (err as Error).message);
        return null;
      }
    }),
  );

  return results.filter((r): r is FacebookPageInsights => r !== null);
}

export async function fetchSpotifyNowPlaying(): Promise<SpotifyNowPlaying[]> {
  const integrations = await db.integration.findMany({
    where: { provider: "spotify", status: { in: ["connected", "error"] } },
  });

  const results = await Promise.all(
    integrations.map(async (integration) => {
      try {
        const token = await getValidAccessToken(integration);
        if (!token) return null;
        const nowPlaying = await fetchSpotifyCurrentOrRecentTrack(token);
        if (!nowPlaying) return null;
        const albumTracks = await fetchSpotifyAlbumTracks(nowPlaying.track.albumId, token);
        await markSynced(integration.id);
        return { ...nowPlaying, albumTracks, accountLabel: integration.label };
      } catch (err) {
        await markSynced(integration.id, (err as Error).message);
        return null;
      }
    }),
  );

  return results.filter((r): r is SpotifyNowPlaying => r !== null);
}

// ---------------------------------------------------------------------------
// Google Calendar
// ---------------------------------------------------------------------------

async function fetchGoogleCalendarEvents(
  accessToken: string,
): Promise<Omit<CalendarEvent, "accountLabel">[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "20");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Google Calendar API error: ${res.status}`);
  const json = await res.json();

  type GoogleEvent = {
    id: string;
    summary?: string;
    location?: string;
    start: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  };
  return ((json.items ?? []) as GoogleEvent[]).map((e) => ({
    id: `google:${e.id}`,
    title: e.summary ?? "(no title)",
    start: e.start.dateTime ?? e.start.date ?? timeMin,
    end: e.end?.dateTime ?? e.end?.date ?? null,
    allDay: Boolean(e.start.date && !e.start.dateTime),
    location: e.location ?? null,
    source: "google" as const,
  }));
}

// ---------------------------------------------------------------------------
// Microsoft Graph — Calendar + Teams chat
// ---------------------------------------------------------------------------

async function fetchMicrosoftCalendarEvents(
  accessToken: string,
): Promise<Omit<CalendarEvent, "accountLabel">[]> {
  const start = new Date().toISOString();
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL("https://graph.microsoft.com/v1.0/me/calendarview");
  url.searchParams.set("startDateTime", start);
  url.searchParams.set("endDateTime", end);
  url.searchParams.set("$orderby", "start/dateTime");
  url.searchParams.set("$top", "20");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Microsoft Graph calendar error: ${res.status}`);
  const json = await res.json();

  type GraphEvent = {
    id: string;
    subject?: string;
    location?: { displayName?: string };
    isAllDay?: boolean;
    start: { dateTime: string };
    end?: { dateTime: string };
  };
  return ((json.value ?? []) as GraphEvent[]).map((e) => ({
    id: `microsoft:${e.id}`,
    title: e.subject ?? "(no title)",
    start: e.start.dateTime,
    end: e.end?.dateTime ?? null,
    allDay: Boolean(e.isAllDay),
    location: e.location?.displayName ?? null,
    source: "microsoft" as const,
  }));
}

/**
 * Reading Teams chat messages needs `Chat.Read`, which is frequently gated
 * behind admin consent in organizational tenants. We degrade to an empty
 * list (rather than throwing) when Graph returns 403 so one missing scope
 * doesn't take down the whole Messages tile.
 */
async function fetchMicrosoftChatMessages(
  accessToken: string,
): Promise<Omit<LiveMessage, "accountLabel">[]> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/chats/getAllMessages?$top=20", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 403) return [];
  if (!res.ok) throw new Error(`Microsoft Graph chat error: ${res.status}`);
  const json = await res.json();

  type GraphMessage = {
    id: string;
    from?: { user?: { displayName?: string } };
    body?: { content?: string };
    createdDateTime: string;
    chatId: string;
  };
  return ((json.value ?? []) as GraphMessage[])
    .filter((m) => m.body?.content)
    .map((m) => ({
      id: `microsoft:${m.id}`,
      text: stripHtml(m.body?.content ?? ""),
      author: m.from?.user?.displayName ?? "Teams",
      channel: "Teams chat",
      timestamp: m.createdDateTime,
      source: "microsoft" as const,
    }));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------

async function fetchSlackMessages(accessToken: string): Promise<Omit<LiveMessage, "accountLabel">[]> {
  const convRes = await fetch(
    "https://slack.com/api/conversations.list?limit=20&types=public_channel,private_channel,mpim,im",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const convJson = await convRes.json();
  if (!convJson.ok) throw new Error(`Slack conversations.list error: ${convJson.error}`);

  type Channel = { id: string; name?: string; is_im?: boolean; user?: string };
  const channels = (convJson.channels ?? []) as Channel[];

  const messages: Omit<LiveMessage, "accountLabel">[] = [];
  for (const channel of channels.slice(0, 8)) {
    const histRes = await fetch(
      `https://slack.com/api/conversations.history?channel=${channel.id}&limit=3`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const histJson = await histRes.json();
    if (!histJson.ok) continue;
    type SlackMsg = { ts: string; text?: string; user?: string };
    for (const m of (histJson.messages ?? []) as SlackMsg[]) {
      if (!m.text) continue;
      messages.push({
        id: `slack:${channel.id}:${m.ts}`,
        text: m.text,
        author: m.user ?? "Slack",
        channel: channel.name ?? (channel.is_im ? "Direct message" : "channel"),
        timestamp: new Date(Number(m.ts.split(".")[0]) * 1000).toISOString(),
        source: "slack" as const,
      });
    }
  }
  return messages;
}

// ---------------------------------------------------------------------------
// Facebook
// ---------------------------------------------------------------------------

/**
 * Recent comments on the Page's posts, using the Page Access Token (not the
 * user token) — this is what `pages_read_engagement`/`pages_read_user_content`
 * actually grant. We pull the last handful of posts and flatten their most
 * recent comments into one activity feed rather than exposing per-post
 * pagination, since the dashboard tile only shows a handful of items anyway.
 */
async function fetchFacebookPageComments(
  pageId: string,
  pageAccessToken: string,
): Promise<Omit<FacebookActivityItem, "accountLabel">[]> {
  const url = new URL(`https://graph.facebook.com/v21.0/${pageId}/feed`);
  url.searchParams.set(
    "fields",
    "message,permalink_url,comments.limit(5){message,from,created_time,permalink_url}",
  );
  url.searchParams.set("limit", "10");
  url.searchParams.set("access_token", pageAccessToken);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Facebook Page feed error: ${res.status}`);
  const json = await res.json();

  type Comment = {
    id: string;
    message?: string;
    from?: { name?: string };
    created_time: string;
    permalink_url?: string;
  };
  type Post = {
    id: string;
    message?: string;
    permalink_url?: string;
    comments?: { data?: Comment[] };
  };

  const items: Omit<FacebookActivityItem, "accountLabel">[] = [];
  for (const post of (json.data ?? []) as Post[]) {
    for (const comment of post.comments?.data ?? []) {
      if (!comment.message) continue;
      items.push({
        id: `facebook:comment:${comment.id}`,
        kind: "comment",
        authorName: comment.from?.name ?? "Someone",
        text: comment.message,
        postMessage: post.message ?? null,
        timestamp: comment.created_time,
        permalink: comment.permalink_url ?? post.permalink_url ?? null,
      });
    }
  }
  return items;
}

/**
 * Recent Messenger conversations for the Page. `/​{page-id}/conversations`
 * only exposes a snippet of the latest message per thread (reading full
 * message bodies needs a per-conversation call this dashboard tile doesn't
 * need) — that snippet is exactly the "new activity" signal the live feed
 * wants.
 */
async function fetchFacebookPageMessages(
  pageId: string,
  pageAccessToken: string,
): Promise<Omit<FacebookActivityItem, "accountLabel">[]> {
  const url = new URL(`https://graph.facebook.com/v21.0/${pageId}/conversations`);
  url.searchParams.set("fields", "snippet,updated_time,participants,link");
  url.searchParams.set("limit", "10");
  url.searchParams.set("access_token", pageAccessToken);

  const res = await fetch(url);
  if (res.status === 403) return []; // pages_messaging not yet granted App Review, if applicable
  if (!res.ok) throw new Error(`Facebook Page conversations error: ${res.status}`);
  const json = await res.json();

  type Participant = { name?: string; id?: string };
  type Conversation = {
    id: string;
    snippet?: string;
    updated_time: string;
    link?: string;
    participants?: { data?: Participant[] };
  };

  return ((json.data ?? []) as Conversation[])
    .filter((c) => c.snippet)
    .map((c) => {
      const other = c.participants?.data?.find((p) => p.id !== pageId);
      return {
        id: `facebook:message:${c.id}`,
        kind: "message" as const,
        authorName: other?.name ?? "Messenger",
        text: c.snippet ?? "",
        postMessage: null,
        timestamp: c.updated_time,
        permalink: c.link ?? null,
      };
    });
}

/**
 * Page-level stats via the Insights API. `read_insights` is scrutinized
 * more tightly than the other Page permissions, and the metric set Meta
 * accepts changes across API versions — degrade individual metrics to null
 * rather than failing the whole tile if one lookup errors.
 */
async function fetchFacebookPageInsights(
  pageId: string,
  pageAccessToken: string,
): Promise<Omit<FacebookPageInsights, "pageName" | "accountLabel">> {
  const profileRes = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=followers_count&access_token=${pageAccessToken}`,
  );
  const profileJson = profileRes.ok ? await profileRes.json() : {};

  const insightsUrl = new URL(`https://graph.facebook.com/v21.0/${pageId}/insights`);
  insightsUrl.searchParams.set("metric", "page_impressions,page_engaged_users,page_fan_adds");
  insightsUrl.searchParams.set("period", "days_28");
  insightsUrl.searchParams.set("access_token", pageAccessToken);
  const insightsRes = await fetch(insightsUrl);
  const insightsJson = insightsRes.ok ? await insightsRes.json() : { data: [] };

  type Metric = { name: string; values?: { value: number }[] };
  const metrics = (insightsJson.data ?? []) as Metric[];
  const latestValue = (name: string) => {
    const metric = metrics.find((m) => m.name === name);
    const values = metric?.values ?? [];
    return values.length > 0 ? values[values.length - 1].value : null;
  };

  return {
    pageId,
    followers: typeof profileJson.followers_count === "number" ? profileJson.followers_count : null,
    impressions28d: latestValue("page_impressions"),
    engagedUsers28d: latestValue("page_engaged_users"),
    newFollowers28d: latestValue("page_fan_adds"),
  };
}

// ---------------------------------------------------------------------------
// Apple Calendar via CalDAV (iCloud)
// ---------------------------------------------------------------------------

async function fetchAppleCalendarEvents(
  appleId: string,
  appSpecificPassword: string,
): Promise<Omit<CalendarEvent, "accountLabel">[]> {
  const client = new DAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: { username: appleId, password: appSpecificPassword },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
  await client.login();
  const calendars = await client.fetchCalendars();

  const timeMin = new Date();
  const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const events: Omit<CalendarEvent, "accountLabel">[] = [];
  for (const calendar of calendars) {
    const objects = await client.fetchCalendarObjects({
      calendar,
      timeRange: {
        start: timeMin.toISOString(),
        end: timeMax.toISOString(),
      },
    });
    for (const obj of objects) {
      const parsed = parseIcsBasic(obj.data ?? "");
      if (!parsed) continue;
      events.push({
        id: `apple:${obj.url}`,
        title: parsed.title,
        start: parsed.start,
        end: parsed.end,
        allDay: parsed.allDay,
        location: parsed.location,
        source: "apple" as const,
      });
    }
  }
  return events;
}

/** Minimal VEVENT parser — avoids pulling in a full ICS library for a handful of fields. */
function parseIcsBasic(
  ics: string,
): { title: string; start: string; end: string | null; allDay: boolean; location: string | null } | null {
  const summaryMatch = ics.match(/SUMMARY:(.*)/);
  const dtStartMatch = ics.match(/DTSTART(?:;[^:]*)?:(\d{8}T?\d{0,6}Z?)/);
  const dtEndMatch = ics.match(/DTEND(?:;[^:]*)?:(\d{8}T?\d{0,6}Z?)/);
  const locationMatch = ics.match(/LOCATION:(.*)/);
  if (!dtStartMatch) return null;

  const allDay = !dtStartMatch[1].includes("T");
  return {
    title: summaryMatch?.[1]?.trim() ?? "(no title)",
    start: icsDateToIso(dtStartMatch[1]),
    end: dtEndMatch ? icsDateToIso(dtEndMatch[1]) : null,
    allDay,
    location: locationMatch?.[1]?.trim() ?? null,
  };
}

function icsDateToIso(value: string): string {
  if (value.includes("T")) {
    const y = value.slice(0, 4);
    const mo = value.slice(4, 6);
    const d = value.slice(6, 8);
    const h = value.slice(9, 11);
    const mi = value.slice(11, 13);
    const s = value.slice(13, 15);
    const zulu = value.endsWith("Z") ? "Z" : "";
    return `${y}-${mo}-${d}T${h}:${mi}:${s}${zulu}`;
  }
  const y = value.slice(0, 4);
  const mo = value.slice(4, 6);
  const d = value.slice(6, 8);
  return `${y}-${mo}-${d}`;
}

// ---------------------------------------------------------------------------
// Spotify
// ---------------------------------------------------------------------------

type SpotifyApiTrack = {
  id: string;
  name: string;
  duration_ms: number;
  external_urls?: { spotify?: string };
  artists?: { name: string }[];
  album?: { id: string; name: string; images?: { url: string }[] };
};

function mapSpotifyTrack(track: SpotifyApiTrack): SpotifyTrack {
  return {
    id: track.id,
    name: track.name,
    artists: (track.artists ?? []).map((a) => a.name).join(", "),
    albumId: track.album?.id ?? "",
    albumName: track.album?.name ?? "",
    albumArtUrl: track.album?.images?.[0]?.url ?? null,
    durationMs: track.duration_ms,
    externalUrl: track.external_urls?.spotify ?? "https://open.spotify.com",
  };
}

/**
 * Prefers whatever's actively playing right now; /me/player/currently-playing
 * returns 204 with no body when nothing is playing (a free-tier Spotify
 * account, or playback paused long enough to time out), so we degrade to the
 * most recent track from /me/player/recently-played instead of showing an
 * empty tile.
 */
async function fetchSpotifyCurrentOrRecentTrack(
  accessToken: string,
): Promise<{ isPlaying: boolean; progressMs: number | null; track: SpotifyTrack } | null> {
  const nowRes = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (nowRes.status === 200) {
    const json = await nowRes.json();
    if (json?.item) {
      return { isPlaying: Boolean(json.is_playing), progressMs: json.progress_ms ?? null, track: mapSpotifyTrack(json.item) };
    }
  } else if (nowRes.status !== 204 && !nowRes.ok) {
    throw new Error(`Spotify currently-playing error: ${nowRes.status}`);
  }

  const recentRes = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!recentRes.ok) throw new Error(`Spotify recently-played error: ${recentRes.status}`);
  const recentJson = await recentRes.json();
  const item = recentJson.items?.[0]?.track;
  if (!item) return null;
  return { isPlaying: false, progressMs: null, track: mapSpotifyTrack(item) };
}

async function fetchSpotifyAlbumTracks(albumId: string, accessToken: string): Promise<SpotifyTrack[]> {
  if (!albumId) return [];
  const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}/tracks?limit=10`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Spotify album tracks error: ${res.status}`);
  const json = await res.json();
  // Album-tracks responses omit each track's own `album` field — the art and
  // album name are the same for every track here, so it's filled back in
  // from the album id/tracks-list context the caller already has.
  const albumRes = await fetch(`https://api.spotify.com/v1/albums/${albumId}?fields=name,images`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const album = albumRes.ok ? await albumRes.json() : null;
  return ((json.items ?? []) as SpotifyApiTrack[]).map((track) =>
    mapSpotifyTrack({ ...track, album: { id: albumId, name: album?.name, images: album?.images } }),
  );
}
