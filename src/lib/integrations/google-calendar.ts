import { db } from "@/lib/db";
import { getValidAccessToken } from "./tokens";
import type { CalendarEvent } from "./live";

export type GoogleCalendarExtras = {
  googleCalendarColor: string | null;
  googleHtmlLink: string | null;
  googleMeetUrl: string | null;
  description: string | null;
  attendees: Array<{
    email: string;
    displayName: string | null;
    responseStatus: string | null;
  }> | null;
};

type GoogleEvent = {
  id: string;
  htmlLink?: string;
  description?: string;
  colorId?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }>;
};

type GoogleColor = {
  background?: string;
  foreground?: string;
};

function emptyExtras(): GoogleCalendarExtras {
  return {
    googleCalendarColor: null,
    googleHtmlLink: null,
    googleMeetUrl: null,
    description: null,
    attendees: null,
  };
}

/**
 * Adds provider-native Google details without making those details part of
 * the common calendar contract. This keeps Microsoft/Apple integrations
 * provider-neutral while letting the UI feel native to Google Calendar.
 */
export async function enrichGoogleCalendarEvents<T extends CalendarEvent>(events: T[]): Promise<Array<T & Partial<GoogleCalendarExtras>>> {
  const googleEvents = events.filter((event) => event.source === "google");
  if (googleEvents.length === 0) return events;

  const integrationIds = [...new Set(googleEvents.map((event) => event.integrationId))];
  const integrations = await db.integration.findMany({ where: { id: { in: integrationIds } } });
  const byIntegration = new Map(integrations.map((integration) => [integration.id, integration]));
  const extrasByKey = new Map<string, GoogleCalendarExtras>();

  await Promise.all(
    integrationIds.map(async (integrationId) => {
      const integration = byIntegration.get(integrationId);
      if (!integration) return;
      try {
        const accessToken = await getValidAccessToken(integration);
        if (!accessToken) return;

        const [eventsResponse, colorsResponse, calendarResponse] = await Promise.all([
          fetchGoogleEvents(accessToken),
          fetch("https://www.googleapis.com/calendar/v3/colors", {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);

        if (!eventsResponse.ok) return;
        const eventJson = await eventsResponse.json();
        const colorsJson = colorsResponse.ok ? await colorsResponse.json() : { event: {} };
        const calendarJson = calendarResponse.ok ? await calendarResponse.json() : {};
        const colorMap = (colorsJson.event ?? {}) as Record<string, GoogleColor>;
        const calendarColor = typeof calendarJson.backgroundColor === "string" ? calendarJson.backgroundColor : null;

        for (const event of (eventJson.items ?? []) as GoogleEvent[]) {
          const meet = event.hangoutLink ?? event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ?? null;
          const color = event.colorId ? colorMap[event.colorId]?.background ?? null : calendarColor;
          const attendees = event.attendees?.filter((attendee) => attendee.email).map((attendee) => ({
            email: attendee.email as string,
            displayName: attendee.displayName ?? null,
            responseStatus: attendee.responseStatus ?? null,
          })) ?? null;

          extrasByKey.set(`${integrationId}:${event.id}`, {
            googleCalendarColor: color,
            googleHtmlLink: event.htmlLink ?? null,
            googleMeetUrl: meet,
            description: event.description ?? null,
            attendees,
          });
        }
      } catch {
        // Enrichment is deliberately best-effort. The base calendar should
        // still render if a secondary Google metadata request is unavailable.
      }
    }),
  );

  return events.map((event) => {
    if (event.source !== "google") return event;
    const extras = extrasByKey.get(`${event.integrationId}:${event.nativeId}`) ?? emptyExtras();
    return { ...event, ...extras };
  });
}

async function fetchGoogleEvents(accessToken: string) {
  const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");
  return fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
}
