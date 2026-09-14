"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import type { CalendarEvent } from "@/lib/integrations/live";
import type { GoogleCalendarExtras } from "@/lib/integrations/google-calendar";

const SOURCE_LABEL: Record<CalendarEvent["source"], string> = {
  google: "Google Calendar",
  microsoft: "Microsoft 365",
  apple: "Apple Calendar",
};

type EnrichedEvent = CalendarEvent & Partial<GoogleCalendarExtras>;

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
  const enriched = event as EnrichedEvent;
  const googleColor = enriched.googleCalendarColor ?? "var(--accent)";
  const attendeeCount = enriched.attendees?.length ?? 0;

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
        className="glass-strong flex max-h-[min(88vh,680px)] w-full max-w-sm flex-col gap-4 overflow-y-auto p-5"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: googleColor }} />
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: googleColor }}>{SOURCE_LABEL[event.source]}</p>
            </div>
            <h3 className="text-base font-semibold leading-snug" style={{ color: "var(--ink)" }}>{event.title}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="min-h-11 min-w-11 shrink-0 rounded-full p-3">
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
              <a href={mapsUrl(event.location)} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-10 items-center gap-1 text-xs font-medium" style={{ color: "var(--accent)" }}>
                <Icon name="directions" className="h-3.5 w-3.5" /> Get directions
              </a>
            </div>
          </div>
        )}

        {enriched.description && (
          <div className="rounded-2xl px-3 py-3 text-sm leading-relaxed" style={{ background: "var(--glass-fill-strong)", color: "var(--ink)" }}>
            {enriched.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
          </div>
        )}

        {event.source === "google" && (enriched.googleMeetUrl || enriched.googleHtmlLink) && (
          <div className="grid grid-cols-2 gap-2">
            {enriched.googleMeetUrl && (
              <a href={enriched.googleMeetUrl} target="_blank" rel="noreferrer" className="glass-pill flex min-h-11 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold" style={{ color: "var(--accent)" }}>
                <Icon name="video_call" className="h-4 w-4" /> Join Meet
              </a>
            )}
            {enriched.googleHtmlLink && (
              <a href={enriched.googleHtmlLink} target="_blank" rel="noreferrer" className="glass-pill flex min-h-11 items-center justify-center gap-2 px-3 py-2 text-sm font-medium" style={{ color: "var(--ink)" }}>
                <span className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>G</span>
                Calendar
              </a>
            )}
          </div>
        )}

        {event.source === "google" && attendeeCount > 0 && (
          <div className="rounded-2xl px-3 py-3" style={{ background: "var(--glass-fill-strong)" }}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>Guests</p>
              <span className="text-[11px]" style={{ color: "var(--ink-soft)" }}>{attendeeCount}</span>
            </div>
            <div className="space-y-1.5">
              {enriched.attendees?.slice(0, 6).map((attendee) => (
                <div key={attendee.email} className="flex items-center gap-2 text-xs">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{(attendee.displayName ?? attendee.email)[0]?.toUpperCase()}</span>
                  <span className="min-w-0 flex-1 truncate" style={{ color: "var(--ink)" }}>{attendee.displayName ?? attendee.email}</span>
                  <span className="shrink-0 capitalize" style={{ color: attendee.responseStatus === "accepted" ? "#34d399" : "var(--ink-soft)" }}>{attendee.responseStatus ?? "pending"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--ink-soft)" }}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: event.source === "google" ? `${googleColor}22` : "var(--accent-soft)", color: googleColor }}>
            {event.source === "google" ? "G" : event.source === "microsoft" ? "M" : ""}
          </span>
          <span>{event.accountLabel}</span>
        </div>

        <div className="mt-1 flex items-center justify-end gap-2">
          {confirming ? (
            <>
              <span className="mr-auto text-xs" style={{ color: "var(--ink-soft)" }}>Delete this event?</span>
              <button onClick={() => setConfirming(false)} className="glass-pill min-h-10 px-3 py-2 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>Cancel</button>
              <button onClick={onDelete} className="glass-pill flex min-h-10 items-center gap-1 px-3 py-2 text-xs font-semibold text-rose-500"><Icon name="delete" className="h-3.5 w-3.5" /> Delete</button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} className="glass-pill flex min-h-10 items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-500"><Icon name="delete" className="h-3.5 w-3.5" /> Delete event</button>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
