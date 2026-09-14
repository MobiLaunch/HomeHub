"use client";

import { useState } from "react";
import { mutate } from "swr";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useLive } from "@/hooks/useLive";
import { useReportActivity } from "@/hooks/useTileActivity";
import { useSnackbar } from "@/hooks/useSnackbar";
import { useRipple } from "@/hooks/useRipple";
import type { CalendarEvent } from "@/lib/integrations/live";
import { AgendaView } from "./calendar/AgendaView";
import { WeekView } from "./calendar/WeekView";
import { MonthView } from "./calendar/MonthView";
import { YearView } from "./calendar/YearView";
import { NewEventForm } from "./calendar/NewEventForm";
import { EventDetailSheet } from "./calendar/EventDetail";
import { addDays, addMonths, addYears } from "./calendar/dateUtils";

type ViewMode = "agenda" | "week" | "month" | "year";
const CALENDAR_URL = "/api/live/calendar";
const VIEWS: { value: ViewMode; label: string }[] = [
  { value: "agenda", label: "Agenda" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export function CalendarTile() {
  const { data, isLoading } = useLive<{ events: CalendarEvent[] }>(CALENDAR_URL, 60_000);
  const events = data?.events ?? [];
  const [view, setView] = useState<ViewMode>("agenda");
  const [anchor, setAnchor] = useState(() => new Date());
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const showSnackbar = useSnackbar();

  const now = Date.now();
  const upcoming = events
    .filter((e) => new Date(e.end ?? e.start).getTime() >= now)
    .sort((a, b) => a.start.localeCompare(b.start));
  const minutesToNext = upcoming.length > 0 ? (new Date(upcoming[0].start).getTime() - now) / 60_000 : Infinity;
  useReportActivity("calendar", minutesToNext <= 30 && minutesToNext >= -5 ? 80 : 0, false);

  function navigate(direction: -1 | 1) {
    setAnchor((prev) => {
      if (view === "week") return addDays(prev, direction * 7);
      if (view === "month") return addMonths(prev, direction);
      if (view === "year") return addYears(prev, direction);
      return prev;
    });
  }

  async function handleDelete(event: CalendarEvent) {
    setSelectedEvent(null);
    mutate(CALENDAR_URL, (current: { events: CalendarEvent[] } | undefined) => current && { events: current.events.filter((e) => e.id !== event.id) }, { revalidate: false });
    await fetch(CALENDAR_URL, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integrationId: event.integrationId, source: event.source, nativeId: event.nativeId }),
    });
    mutate(CALENDAR_URL);
    showSnackbar(`Deleted "${event.title}"`);
  }

  if (isLoading && events.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
        <Icon name="calendar_month" className="h-6 w-6" style={{ color: "var(--ink-soft)" }} />
        <p className="max-w-xs text-sm" style={{ color: "var(--ink-soft)" }}>Loading your calendars…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ViewSwitcher value={view} onChange={setView} />
        <div className="ml-auto flex items-center gap-1.5">
          {view !== "agenda" && (
            <>
              <NavButton icon="chevron_left" label="Previous" onClick={() => navigate(-1)} />
              <button onClick={() => setAnchor(new Date())} className="glass-pill min-h-8 px-3 py-1.5 text-xs font-medium" style={{ color: "var(--accent)" }}>Today</button>
              <NavButton icon="chevron_right" label="Next" onClick={() => navigate(1)} />
            </>
          )}
          <NewEventButton onClick={() => setShowNewEvent(true)} />
        </div>
      </div>

      {upcoming.length > 0 && (
        <NextUp event={upcoming[0]} onSelect={setSelectedEvent} />
      )}

      <AnimatePresence mode="wait">
        <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
          {view === "agenda" && <AgendaView events={events} onSelect={setSelectedEvent} />}
          {view === "week" && <WeekView events={events} anchor={anchor} onSelect={setSelectedEvent} />}
          {view === "month" && <MonthView events={events} anchor={anchor} onDayClick={(day) => { setAnchor(day); setView("week"); }} />}
          {view === "year" && <YearView events={events} anchor={anchor} onMonthClick={(monthAnchor) => { setAnchor(monthAnchor); setView("month"); }} onDayClick={(day) => { setAnchor(day); setView("week"); }} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>{showNewEvent && <NewEventForm onClose={() => setShowNewEvent(false)} defaultDate={anchor} />}</AnimatePresence>
      <AnimatePresence>{selectedEvent && <EventDetailSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} onDelete={() => handleDelete(selectedEvent)} />}</AnimatePresence>
    </div>
  );
}

function NextUp({ event, onSelect }: { event: CalendarEvent; onSelect: (event: CalendarEvent) => void }) {
  const { onPointerDown, rippleLayer } = useRipple<HTMLButtonElement>();
  const start = new Date(event.start);
  const delta = start.getTime() - Date.now();
  const relative = delta <= 0 ? "Now" : delta < 3_600_000 ? `In ${Math.max(1, Math.round(delta / 60_000))} min` : start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <button onClick={() => onSelect(event)} onPointerDown={onPointerDown} className="ripple-surface relative flex min-h-16 w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-left" style={{ background: "var(--accent-soft)", color: "var(--ink)" }}>
      {rippleLayer}
      <span className="h-9 w-1 rounded-full" style={{ background: "var(--accent)" }} />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>Next up · {relative}</span>
        <span className="mt-0.5 block truncate text-sm font-semibold">{event.title}</span>
      </span>
      <Icon name="chevron_right" className="h-5 w-5 shrink-0" style={{ color: "var(--ink-soft)" }} />
    </button>
  );
}

function ViewSwitcher({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return <div className="glass-pill relative inline-flex max-w-full overflow-x-auto p-1">{VIEWS.map((v) => <ViewSegment key={v.value} active={value === v.value} label={v.label} onSelect={() => onChange(v.value)} />)}</div>;
}

function ViewSegment({ active, label, onSelect }: { active: boolean; label: string; onSelect: () => void }) {
  const { onPointerDown, rippleLayer } = useRipple<HTMLButtonElement>();
  return <button onClick={onSelect} onPointerDown={onPointerDown} className="ripple-surface relative min-h-8 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium" style={{ color: active ? "var(--on-accent)" : "var(--ink-soft)" }}>{active && <motion.span layoutId="calendar-view-active" transition={{ type: "spring", stiffness: 500, damping: 32 }} className="absolute inset-0 rounded-full" style={{ background: "var(--accent)" }} />}{rippleLayer}<span className="relative">{label}</span></button>;
}

function NavButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  const { onPointerDown, rippleLayer } = useRipple<HTMLButtonElement>();
  return <button onClick={onClick} onPointerDown={onPointerDown} aria-label={label} className="ripple-surface glass-pill flex h-9 w-9 items-center justify-center">{rippleLayer}<Icon name={icon} className="h-4 w-4" style={{ color: "var(--ink-soft)" }} /></button>;
}

function NewEventButton({ onClick }: { onClick: () => void }) {
  const { onPointerDown, rippleLayer } = useRipple<HTMLButtonElement>();
  return <motion.button onClick={onClick} onPointerDown={onPointerDown} whileTap={{ scale: 0.94 }} aria-label="New event" className="ripple-surface glass-pill flex h-9 w-9 items-center justify-center">{rippleLayer}<Icon name="add" className="h-4 w-4" style={{ color: "var(--accent)" }} /></motion.button>;
}
