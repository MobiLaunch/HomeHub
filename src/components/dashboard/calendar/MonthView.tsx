"use client";

import { motion } from "framer-motion";
import type { CalendarEvent } from "@/lib/integrations/live";
import { eventsOnDay, isSameDay, monthGridDays } from "./dateUtils";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MAX_VISIBLE = 3;

export function MonthView({
  events,
  anchor,
  onDayClick,
}: {
  events: CalendarEvent[];
  anchor: Date;
  onDayClick: (day: Date) => void;
}) {
  const days = monthGridDays(anchor);
  const today = new Date();
  const currentMonth = anchor.getMonth();

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="pb-1 text-center text-[11px] font-medium" style={{ color: "var(--ink-soft)" }}>
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const dayEvents = eventsOnDay(events, day);
          const isToday = isSameDay(day, today);
          const inMonth = day.getMonth() === currentMonth;
          return (
            <motion.button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: inMonth ? 1 : 0.35, scale: 1 }}
              transition={{ delay: i * 0.008 }}
              whileHover={{ scale: 1.03 }}
              className="flex min-h-[3.5rem] flex-col items-start gap-0.5 rounded-xl p-1.5 text-left sm:min-h-[4.5rem]"
              style={{ background: isToday ? "var(--accent-soft)" : "var(--glass-fill-strong)" }}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{ background: isToday ? "var(--accent)" : "transparent", color: isToday ? "var(--on-accent)" : "var(--ink)" }}
              >
                {day.getDate()}
              </span>
              <div className="flex w-full flex-col gap-0.5">
                {dayEvents.slice(0, MAX_VISIBLE).map((event) => (
                  <span
                    key={event.id}
                    className="w-full truncate rounded px-1 text-[10px] leading-tight"
                    style={{ background: "var(--surface-card)", color: "var(--ink)" }}
                  >
                    {event.title}
                  </span>
                ))}
                {dayEvents.length > MAX_VISIBLE && (
                  <span className="px-1 text-[10px]" style={{ color: "var(--ink-soft)" }}>
                    +{dayEvents.length - MAX_VISIBLE} more
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
