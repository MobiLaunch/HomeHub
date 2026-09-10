"use client";

import { CalendarDays } from "lucide-react";
import { useLive } from "@/hooks/useLive";
import type { CalendarEvent } from "@/lib/integrations/live";

function formatWhen(event: CalendarEvent) {
  const start = new Date(event.start);
  if (event.allDay) {
    return start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  const now = new Date();
  const sameDay = start.toDateString() === now.toDateString();
  const datePart = sameDay
    ? "Today"
    : start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const timePart = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

const SOURCE_COLOR: Record<CalendarEvent["source"], string> = {
  google: "#4285f4",
  microsoft: "#7719aa",
  apple: "#94a3b8",
};

export function CalendarTile() {
  const { data, isLoading } = useLive<{ events: CalendarEvent[] }>("/api/live/calendar", 60_000);
  const events = data?.events ?? [];

  if (isLoading && events.length === 0) {
    return <EmptyState text="Loading your calendar…" />;
  }
  if (events.length === 0) {
    return (
      <EmptyState text="Nothing on the calendar for the next 7 days — or no calendar connected yet." />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {events.slice(0, 6).map((event) => (
        <li key={event.id} className="flex items-start gap-3 rounded-2xl px-3 py-2.5" style={{ background: "var(--glass-fill-strong)" }}>
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ background: SOURCE_COLOR[event.source] }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" style={{ color: "var(--ink)" }}>
              {event.title}
            </p>
            <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
              {formatWhen(event)}
              {event.location ? ` · ${event.location}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
      <CalendarDays className="h-5 w-5" style={{ color: "var(--ink-soft)" }} />
      <p className="max-w-[220px] text-xs" style={{ color: "var(--ink-soft)" }}>
        {text}
      </p>
    </div>
  );
}
