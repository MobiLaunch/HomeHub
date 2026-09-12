"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import { useLive } from "@/hooks/useLive";
import type { CalendarEvent } from "@/lib/integrations/live";

const SOURCE_META = {
  google: { label: "Google", mark: "G" },
  microsoft: { label: "Microsoft", mark: "M" },
  apple: { label: "Apple", mark: "" },
  facebook: { label: "Facebook", mark: "f" },
} as const;

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

export function CalendarTile() {
  const { data, isLoading } = useLive<{ events: CalendarEvent[] }>("/api/live/calendar", 60_000);
  const events = (data?.events ?? []).slice(0, 30);
  const grouped = events.reduce<Record<string, CalendarEvent[]>>((groups, event) => {
    const key = dayKey(event.start);
    (groups[key] ??= []).push(event);
    return groups;
  }, {});
  const days = Object.entries(grouped);

  if (isLoading && events.length === 0) return <EmptyState text="Loading your calendars…" />;
  if (events.length === 0) return <EmptyState text="No upcoming events. Connect Google or Apple Calendar in Settings." />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2" aria-label="Calendar sources">
        {Object.entries(SOURCE_META).map(([source, meta]) => {
          const count = events.filter((event) => event.source === source).length;
          if (!count) return null;
          return <span key={source} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "var(--glass-fill-strong)", color: "var(--ink-soft)" }}><span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px]" style={{ background: "var(--glass-fill)", color: "var(--ink)" }}>{meta.mark}</span>{meta.label} · {count}</span>;
        })}
        <span className="ml-auto text-xs" style={{ color: "var(--ink-soft)" }}>{events.length} upcoming</span>
      </div>

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
                  {dayEvents.map((event) => (
                    <motion.article key={event.id} layout whileHover={{ x: 2 }} className="group grid grid-cols-[4.5rem_1fr] gap-3 rounded-2xl p-3 sm:grid-cols-[5.5rem_1fr]" style={{ background: "var(--glass-fill-strong)" }}>
                      <div className="pt-0.5 text-xs font-medium" style={{ color: "var(--ink-soft)" }}><div className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{timeLabel(event)}</div></div>
                      <div className="min-w-0 border-l pl-3" style={{ borderColor: "var(--glass-border)" }}>
                        <div className="flex items-start gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--accent)" }} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-5" style={{ color: "var(--ink)" }}>{event.title}</p><p className="mt-0.5 text-xs" style={{ color: "var(--ink-soft)" }}>{SOURCE_META[event.source].label} · {event.accountLabel}</p>{event.location && <p className="mt-1 flex items-center gap-1 truncate text-xs" style={{ color: "var(--ink-soft)" }}><MapPin className="h-3 w-3 shrink-0" />{event.location}</p>}</div></div>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-56 flex-col items-center justify-center gap-3 text-center"><CalendarDays className="h-7 w-7" style={{ color: "var(--ink-soft)" }} /><p className="max-w-xs text-sm" style={{ color: "var(--ink-soft)" }}>{text}</p></motion.div>;
}
