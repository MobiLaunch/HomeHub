"use client";

import { motion } from "framer-motion";
import type { CalendarEvent } from "@/lib/integrations/live";
import { eventsOnDay, isSameDay, monthGridDays } from "./dateUtils";

export function YearView({
  events,
  anchor,
  onMonthClick,
  onDayClick,
}: {
  events: CalendarEvent[];
  anchor: Date;
  onMonthClick: (monthAnchor: Date) => void;
  onDayClick: (day: Date) => void;
}) {
  const year = anchor.getFullYear();
  const today = new Date();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }, (_, month) => {
        const monthAnchor = new Date(year, month, 1);
        const days = monthGridDays(monthAnchor);
        return (
          <motion.div
            key={month}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: month * 0.02 }}
            className="rounded-2xl p-2.5"
            style={{ background: "var(--glass-fill-strong)" }}
          >
            <button
              onClick={() => onMonthClick(monthAnchor)}
              className="mb-1.5 text-xs font-semibold"
              style={{ color: "var(--ink)" }}
            >
              {monthAnchor.toLocaleDateString(undefined, { month: "long" })}
            </button>
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day) => {
                const inMonth = day.getMonth() === month;
                const hasEvents = eventsOnDay(events, day).length > 0;
                const isToday = isSameDay(day, today);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => onDayClick(day)}
                    className="flex aspect-square items-center justify-center rounded text-[9px]"
                    style={{
                      opacity: inMonth ? 1 : 0.25,
                      background: isToday ? "var(--accent)" : "transparent",
                      color: isToday ? "var(--on-accent)" : "var(--ink-soft)",
                    }}
                  >
                    <span className="relative">
                      {day.getDate()}
                      {hasEvents && !isToday && (
                        <span
                          className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                          style={{ background: "var(--accent)" }}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
