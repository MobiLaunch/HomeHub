import { NextResponse } from "next/server";
import { fetchCalendarEvents, fetchLiveNotifications } from "@/lib/integrations/live";
import type { CalendarEvent } from "@/lib/integrations/live";

export async function GET() {
  const [events, notifications] = await Promise.all([
    fetchCalendarEvents(),
    fetchLiveNotifications(),
  ]);

  // Facebook no longer exposes a general third-party calendar feed. When the
  // connected account exposes its birthday, surface that supported Facebook
  // date in the same unified agenda instead of pretending it is a full calendar.
  const facebookEvents = notifications
    .filter((notification) => notification.type === "birthday")
    .map((notification) => ({
      id: notification.id,
      title: notification.title,
      start: notification.date,
      end: null,
      allDay: true,
      location: null,
      source: "facebook",
      accountLabel: notification.accountLabel,
    })) as unknown as CalendarEvent[];

  return NextResponse.json({
    events: [...events, ...facebookEvents].sort((a, b) => a.start.localeCompare(b.start)),
  });
}
