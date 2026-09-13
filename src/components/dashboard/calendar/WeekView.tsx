"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import type { CalendarEvent } from "@/lib/integrations/live";
import { eventsOnDay, isSameDay, weekDays } from "./dateUtils";

const SOURCE_DOT: Record<CalendarEvent["source"], string> = {
  google: "#4285f4",
  microsoft: "#2b579a",
  apple: "#8e8e93",
};

export function WeekView({
  events,
  anchor,
  onSelect,
}: {
  events: CalendarEvent[];
  anchor: Date;
  onSelect: (event: CalendarEvent) => void;
}) {
  const days = weekDays(anchor);
  const today = new Date();

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {days.map((day, i) => {
        const dayEvents = eventsOnDay(events, day);
        const isToday = isSameDay(day, today);
        return (
          <motion.div
            key={day.toISOString()}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex min-h-[9rem] flex-col gap-1.5 rounded-2xl p-2.5 sm:min-h-[16rem]"
            style={{ background: isToday ? "var(--accent-soft)" : "var(--glass-fill-strong)" }}
          >
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[11px] font-medium uppercase" style={{ color: "var(--ink-soft)" }}>
                {day.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                style={{ background: isToday ? "var(--accent)" : "transparent", color: isToday ? "var(--on-accent)" : "var(--ink)" }}
              >
                {day.getDate()}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {dayEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => onSelect(event)}
                  className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight"
                  style={{ background: "var(--surface-card)", color: "var(--ink)" }}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SOURCE_DOT[event.source] }} />
                  <span className="truncate">{event.title}</span>
                </button>
              ))}
              {dayEvents.length === 0 && <span className="flex-1" />}
            </div>
          </motion.div>
        );
      })}
      {days.every((d) => eventsOnDay(events, d).length === 0) && (
        <div className="col-span-full flex items-center justify-center gap-2 py-4 text-xs" style={{ color: "var(--ink-soft)" }}>
          <Icon name="calendar_month" className="h-4 w-4" />
          Nothing scheduled this week.
        </div>
      )}
    </div>
  );
}
