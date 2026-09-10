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

export type LiveNotification = {
  id: string;
  type: "birthday" | "social";
  title: string;
  subtitle: string | null;
  date: string; // ISO
  source: "facebook";
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

export async function fetchLiveNotifications(): Promise<LiveNotification[]> {
  const integrations = await db.integration.findMany({
    where: { provider: "facebook", status: { in: ["connected", "error"] } },
  });

  const results = await Promise.all(
    integrations.map(async (integration) => {
      try {
        const token = await getValidAccessToken(integration);
        if (!token) return [];
        const notifications = await fetchFacebookNotifications(token);
        await markSynced(integration.id);
        return notifications.map((n) => ({ ...n, accountLabel: integration.label }));
      } catch (err) {
        await markSynced(integration.id, (err as Error).message);
        return [];
      }
    }),
  );

  return results.flat();
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
 * Meta's Graph API has not allowed third-party apps to read a friend list's
 * birthdays since the 2018 platform lockdown — `user_friends` only returns
 * friends who also authorized this same app. We surface the connected
 * account's own profile/birthday as a "notification" so the tile is
 * genuinely live rather than pretending friend-birthday sync works.
 */
async function fetchFacebookNotifications(
  accessToken: string,
): Promise<Omit<LiveNotification, "accountLabel">[]> {
  const res = await fetch(
    `https://graph.facebook.com/me?fields=id,name,birthday&access_token=${accessToken}`,
  );
  if (!res.ok) throw new Error(`Facebook Graph API error: ${res.status}`);
  const json = await res.json();
  if (!json.birthday) return [];

  const [month, day] = json.birthday.split("/");
  const now = new Date();
  const nextBirthday = new Date(now.getFullYear(), Number(month) - 1, Number(day));
  if (nextBirthday < now) nextBirthday.setFullYear(now.getFullYear() + 1);

  return [
    {
      id: `facebook:${json.id}:birthday`,
      type: "birthday" as const,
      title: `${json.name}'s birthday`,
      subtitle: "From Facebook",
      date: nextBirthday.toISOString(),
      source: "facebook" as const,
    },
  ];
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
