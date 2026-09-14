"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import type { CalendarEvent } from "@/lib/integrations/live";

const SOURCE_LABEL: Record<CalendarEvent["source"], string> = {
  google: "Google Calendar",
  microsoft: "Microsoft 365",
  apple: "Apple Calendar",
};

function formatWhen(event: CalendarEvent): string {
  const start = new Date(event.start);
  if (event.allDay) {
    return start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }
  const end = event.end ? new Date(event.end) : null;
  const datePart = start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endTime = end?.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return endTime ? `${datePart} · ${startTime} – ${endTime}` : `${datePart} · ${startTime}`;
}

function mapsUrl(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

function calendarSearchUrl(event: CalendarEvent) {
  const query = `${event.title} ${new Date(event.start).toLocaleDateString()}`;
  return `https://calendar.google.com/calendar/u/0/r/search?q=${encodeURIComponent(query)}`;
}

export function EventDetailSheet({
  event,
  onClose,
  onDelete,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.3)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong flex w-full max-w-sm flex-col gap-4 p-5"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--accent)" }}>{SOURCE_LABEL[event.source]}</p>
            <h3 className="text-base font-semibold leading-snug" style={{ color: "var(--ink)" }}>{event.title}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 rounded-full p-1">
            <Icon name="close" className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
          </button>
        </div>

        <div className="flex items-start gap-2 text-sm" style={{ color: "var(--ink)" }}>
          <Icon name="schedule" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--ink-soft)" }} />
          <span>{formatWhen(event)}</span>
        </div>

        {event.location && (
          <div className="flex items-start gap-2 text-sm" style={{ color: "var(--ink)" }}>
            <Icon name="location_on" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--ink-soft)" }} />
            <div className="min-w-0 flex-1">
              <p>{event.location}</p>
              <a href={mapsUrl(event.location)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent)" }}>
                <Icon name="directions" className="h-3.5 w-3.5" /> Get directions
              </a>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--ink-soft)" }}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            {event.source === "google" ? "G" : event.source === "microsoft" ? "M" : ""}
          </span>
          <span>{event.accountLabel}</span>
        </div>

        {event.source === "google" && (
          <a
            href={calendarSearchUrl(event)}
            target="_blank"
            rel="noreferrer"
            className="glass-pill flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
            style={{ color: "var(--accent)" }}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold" style={{ background: "var(--accent-soft)" }}>G</span>
            Open in Google Calendar
          </a>
        )}

        <div className="mt-1 flex items-center justify-end gap-2">
          {confirming ? (
            <>
              <span className="mr-auto text-xs" style={{ color: "var(--ink-soft)" }}>Delete this event?</span>
              <button onClick={() => setConfirming(false)} className="glass-pill px-3 py-1.5 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>Cancel</button>
              <button onClick={onDelete} className="glass-pill flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-500"><Icon name="delete" className="h-3.5 w-3.5" /> Delete</button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} className="glass-pill flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-500"><Icon name="delete" className="h-3.5 w-3.5" /> Delete event</button>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
