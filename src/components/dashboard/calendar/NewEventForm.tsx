"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { mutate } from "swr";
import { Icon } from "@/components/Icon";
import { Switch } from "@/components/Switch";
import { useLive } from "@/hooks/useLive";
import { useSnackbar } from "@/hooks/useSnackbar";
import type { CalendarEvent } from "@/lib/integrations/live";

type ProviderAccount = { id: string; label: string; status: string };
type ProviderInfo = { id: string; displayName: string; accounts: ProviderAccount[] };

const CALENDAR_URL = "/api/live/calendar";
const CALENDAR_PROVIDERS = new Set(["google", "microsoft", "apple"]);

export function NewEventForm({ onClose, defaultDate }: { onClose: () => void; defaultDate: Date }) {
  const { data } = useLive<{ providers: ProviderInfo[] }>("/api/integrations", 60_000);
  const calendarAccounts = (data?.providers ?? [])
    .filter((p) => CALENDAR_PROVIDERS.has(p.id))
    .flatMap((p) =>
      p.accounts
        .filter((a) => a.status === "connected")
        .map((a) => ({ integrationId: a.id, label: `${p.displayName} · ${a.label}` })),
    );

  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState(defaultDate.toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [integrationId, setIntegrationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showSnackbar = useSnackbar();

  const selectedIntegrationId = integrationId || calendarAccounts[0]?.integrationId || "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !selectedIntegrationId) return;
    setBusy(true);
    setError(null);
    const start = allDay ? `${startDate}T00:00:00.000Z` : new Date(`${startDate}T${startTime}`).toISOString();
    const end = allDay ? `${startDate}T00:00:00.000Z` : new Date(`${startDate}T${endTime}`).toISOString();
    try {
      const res = await fetch(CALENDAR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationId: selectedIntegrationId,
          title,
          start,
          end,
          allDay,
          location: location || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create event");
      mutate(
        CALENDAR_URL,
        (current: { events: CalendarEvent[] } | undefined) =>
          current && { events: [...current.events, json.event as CalendarEvent] },
        { revalidate: false },
      );
      mutate(CALENDAR_URL);
      showSnackbar("Event created");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
      <motion.form
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="glass-strong flex w-full max-w-sm flex-col gap-3 p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            New event
          </h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <Icon name="close" className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
          </button>
        </div>

        {calendarAccounts.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
            Connect Google, Microsoft, or Apple Calendar in Settings first to add events.
          </p>
        ) : (
          <>
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              className="glass-pill px-3 py-2 text-sm outline-none"
              style={{ color: "var(--ink)" }}
            />

            <div className="flex items-center justify-between px-1">
              <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
                All day
              </span>
              <Switch checked={allDay} onChange={setAllDay} label="All day" />
            </div>

            <div className="flex gap-2">
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="glass-pill flex-1 px-3 py-2 text-sm outline-none"
                style={{ color: "var(--ink)" }}
              />
              {!allDay && (
                <>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="glass-pill px-3 py-2 text-sm outline-none"
                    style={{ color: "var(--ink)" }}
                  />
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="glass-pill px-3 py-2 text-sm outline-none"
                    style={{ color: "var(--ink)" }}
                  />
                </>
              )}
            </div>

            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (optional)"
              className="glass-pill px-3 py-2 text-sm outline-none"
              style={{ color: "var(--ink)" }}
            />

            {calendarAccounts.length > 1 && (
              <select
                value={selectedIntegrationId}
                onChange={(e) => setIntegrationId(e.target.value)}
                className="glass-pill px-3 py-2 text-sm outline-none"
                style={{ color: "var(--ink)" }}
              >
                {calendarAccounts.map((a) => (
                  <option key={a.integrationId} value={a.integrationId}>
                    {a.label}
                  </option>
                ))}
              </select>
            )}

            {error && <p className="text-xs text-rose-500">{error}</p>}

            <motion.button
              type="submit"
              disabled={busy}
              whileTap={{ scale: 0.97 }}
              className="glass-pill flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ color: "var(--accent)" }}
            >
              {busy ? <Icon name="progress_activity" className="h-4 w-4 animate-spin" /> : <Icon name="add" className="h-4 w-4" />}
              Add event
            </motion.button>
          </>
        )}
      </motion.form>
    </motion.div>,
    document.body,
  );
}
