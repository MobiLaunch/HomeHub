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

  // Portalled to <body> — nesting a `position: fixed` overlay inside a
  // framer-motion-animated ancestor (the dashboard Tile) makes it fixed
  // relative to that ancestor instead of the viewport, since a `transform`
  // anywhere up the tree changes the containing block for fixed descendants.
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
        className="glass-strong flex w-full max-w-sm flex-col gap-3 p-5"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug" style={{ color: "var(--ink)" }}>
            {event.title}
          </h3>
          <button onClick={onClose} aria-label="Close" className="shrink-0">
            <Icon name="close" className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
          </button>
        </div>

        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink)" }}>
          <Icon name="schedule" className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
          {formatWhen(event)}
        </div>

        {event.location && (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink)" }}>
            <Icon name="location_on" className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
            {event.location}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--ink-soft)" }}>
          <Icon name="calendar_month" className="h-3.5 w-3.5" />
          {SOURCE_LABEL[event.source]} · {event.accountLabel}
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          {confirming ? (
            <>
              <span className="mr-auto text-xs" style={{ color: "var(--ink-soft)" }}>
                Delete this event?
              </span>
              <button
                onClick={() => setConfirming(false)}
                className="glass-pill px-3 py-1.5 text-xs font-medium"
                style={{ color: "var(--ink-soft)" }}
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                className="glass-pill flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-500"
              >
                <Icon name="delete" className="h-3.5 w-3.5" />
                Delete
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="glass-pill flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-500"
            >
              <Icon name="delete" className="h-3.5 w-3.5" />
              Delete event
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
