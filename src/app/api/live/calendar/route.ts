import { NextResponse } from "next/server";
import { createCalendarEvent, deleteCalendarEvent, fetchCalendarEvents } from "@/lib/integrations/live";
import type { CalendarEvent } from "@/lib/integrations/live";
import { enrichGoogleCalendarEvents } from "@/lib/integrations/google-calendar";

export async function GET() {
  const events = await fetchCalendarEvents();
  const enrichedEvents = await enrichGoogleCalendarEvents(events);
  return NextResponse.json({ events: enrichedEvents });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    integrationId?: string;
    title?: string;
    start?: string;
    end?: string;
    allDay?: boolean;
    location?: string;
  };
  if (!body.integrationId || !body.title || !body.start || !body.end) {
    return NextResponse.json({ error: "integrationId, title, start, and end are required" }, { status: 400 });
  }

  try {
    const event = await createCalendarEvent(body.integrationId, {
      title: body.title,
      start: body.start,
      end: body.end,
      allDay: Boolean(body.allDay),
      location: body.location,
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as {
    integrationId?: string;
    source?: CalendarEvent["source"];
    nativeId?: string;
  };
  if (!body.integrationId || !body.source || !body.nativeId) {
    return NextResponse.json({ error: "integrationId, source, and nativeId are required" }, { status: 400 });
  }

  try {
    await deleteCalendarEvent(body.integrationId, body.source, body.nativeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
