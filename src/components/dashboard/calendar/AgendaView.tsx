"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/Icon";
import type { CalendarEvent } from "@/lib/integrations/live";
import type { GoogleCalendarExtras } from "@/lib/integrations/google-calendar";

const SOURCE_META: Record<CalendarEvent["source"], { label: string; mark: string }> = {
  google: { label: "Google", mark: "G" },
  microsoft: { label: "Microsoft", mark: "M" },
  apple: { label: "Apple", mark: "" },
};

type EnrichedEvent = CalendarEvent & Partial<GoogleCalendarExtras>;

function dayKey(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
}
function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
function timeLabel(event: CalendarEvent) {
  if (event.allDay) return "All day";
  return new Date(event.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function mapsUrl(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

export function AgendaView({
  events,
  onSelect,
}: {
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
}) {
  // eslint-disable-next-line react-hooks/purity
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const upcoming = events.filter((e) => new Date(e.end ?? e.start).getTime() >= cutoff).slice(0, 30);

  if (upcoming.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
        <Icon name="calendar_month" className="h-6 w-6" style={{ color: "var(--ink-soft)" }} />
        <p className="max-w-xs text-sm" style={{ color: "var(--ink-soft)" }}>
          No upcoming events. Connect a calendar in Settings, or add one with the button above.
        </p>
      </div>
    );
  }

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const nextEvent = upcoming.find((event) => new Date(event.start).getTime() >= nowMs);
  const grouped = upcoming.reduce<Record<string, CalendarEvent[]>>((groups, event) => {
    const key = dayKey(event.start);
    (groups[key] ??= []).push(event);
    return groups;
  }, {});
  const days = Object.entries(grouped);

  return (
    <div className="space-y-4">
      {nextEvent && (
        <button onClick={() => onSelect(nextEvent)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left active:scale-[0.99]" style={{ background: "var(--accent-soft)" }}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            <Icon name="schedule" className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--accent)" }}>Next up</p>
            <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>{nextEvent.title}</p>
          </div>
          <span className="ml-auto shrink-0 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>{timeLabel(nextEvent)}</span>
        </button>
      )}

      <div className="max-h-[52vh] overflow-y-auto pr-1 sm:max-h-[560px]">
        <div className="space-y-5">
          <AnimatePresence initial={false}>
            {days.map(([key, dayEvents], dayIndex) => (
              <motion.section key={key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: dayIndex * 0.03 }}>
                <div className="sticky top-0 z-10 mb-2 flex items-center gap-3 py-1" style={{ background: "var(--glass-fill)" }}>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{dayLabel(dayEvents[0].start)}</h3>
                  <span className="h-px flex-1" style={{ background: "var(--glass-border)" }} />
                  <span className="text-xs" style={{ color: "var(--ink-soft)" }}>{dayEvents.length}</span>
                </div>
                <div className="space-y-2">
                  {dayEvents.map((event) => {
                    const enriched = event as EnrichedEvent;
                    const eventColor = enriched.googleCalendarColor ?? (event.source === "google" ? "var(--accent)" : "var(--ink-soft)");
                    return (
                      <motion.div
                        key={event.id}
                        layout
                        whileHover={{ x: 2 }}
                        className="group grid w-full grid-cols-[4.5rem_1fr] gap-3 rounded-2xl p-3 text-left sm:grid-cols-[5.5rem_1fr]"
                        style={{ background: "var(--glass-fill-strong)" }}
                      >
                        <button onClick={() => onSelect(event)} className="min-h-11 pt-0.5 text-left text-xs font-medium" style={{ color: "var(--ink-soft)" }} aria-label={`Open ${event.title}`}>
                          <div className="flex items-center gap-1"><Icon name="schedule" className="h-3.5 w-3.5" />{timeLabel(event)}</div>
                        </button>
                        <div className="min-w-0 border-l pl-3" style={{ borderColor: "var(--glass-border)" }}>
                          <div className="flex items-start gap-2">
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: eventColor }} />
                            <div className="min-w-0 flex-1">
                              <button onClick={() => onSelect(event)} className="block min-h-11 w-full text-left">
                                <p className="text-sm font-semibold leading-5" style={{ color: "var(--ink)" }}>{event.title}</p>
                                <p className="mt-0.5 text-xs" style={{ color: "var(--ink-soft)" }}>{SOURCE_META[event.source].label} · {event.accountLabel}</p>
                              </button>
                              <div className="flex flex-wrap items-center gap-2">
                                {event.location && (
                                  <a href={mapsUrl(event.location)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex min-h-9 max-w-full min-w-0 items-center gap-1 truncate rounded-full px-1.5 text-xs hover:underline" style={{ color: "var(--ink-soft)" }}>
                                    <Icon name="location_on" className="h-3 w-3 shrink-0" />{event.location}
                                  </a>
                                )}
                                {event.source === "google" && enriched.googleMeetUrl && (
                                  <a href={enriched.googleMeetUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[11px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                                    <Icon name="video_call" className="h-3.5 w-3.5" /> Meet
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export { SOURCE_META };
