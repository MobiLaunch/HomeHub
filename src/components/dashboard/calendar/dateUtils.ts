import type { CalendarEvent } from "@/lib/integrations/live";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function addYears(d: Date, n: number): Date {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
}

/** Sunday-start week, matching Date#getDay()'s own 0=Sunday convention. */
export function startOfWeek(d: Date): Date {
  return addDays(startOfDay(d), -d.getDay());
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/**
 * Events on a given day, keyed by start date only — a multi-day event (start
 * and end on different calendar days) is treated as living on its start day
 * alone, the same simplification the original agenda list already made.
 */
export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((e) => isSameDay(new Date(e.start), day))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** 6 rows x 7 days covering the given month, including the leading/trailing
 * days from neighboring months needed to fill the grid. */
export function monthGridDays(monthAnchor: Date): Date[] {
  const firstOfMonth = startOfMonth(monthAnchor);
  const gridStart = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function weekDays(weekAnchor: Date): Date[] {
  const start = startOfWeek(weekAnchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
