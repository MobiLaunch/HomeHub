"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Cake, ChevronRight, MapPin, Clock } from "lucide-react";
import { useLive } from "@/hooks/useLive";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import type { CalendarEvent, LiveMessage, LiveNotification } from "@/lib/integrations/live";

type ActivityItem =
  | { kind: "message"; id: string; author: string; channel: string; text: string }
  | { kind: "calendar"; id: string; title: string; when: string; allDay: boolean; location: string | null }
  | { kind: "social"; id: string; title: string; subtitle: string | null; date: string };

const CARD_STYLE: Record<ActivityItem["kind"], { gradient: string; ink: string }> = {
  message: { gradient: "linear-gradient(135deg, #7c7bff, #a78bfa)", ink: "#ffffff" },
  calendar: { gradient: "linear-gradient(135deg, #60a5fa, #38bdf8)", ink: "#ffffff" },
  social: { gradient: "linear-gradient(135deg, #f472b6, #fb923c)", ink: "#ffffff" },
};

function formatEventWhen(event: CalendarEvent): string {
  const start = new Date(event.start);
  if (event.allDay) return start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const sameDay = start.toDateString() === new Date().toDateString();
  const day = sameDay ? "Today" : start.toLocaleDateString(undefined, { weekday: "short" });
  return `${day} · ${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function LiveActivityStack() {
  const { data: calendarData } = useLive<{ events: CalendarEvent[] }>("/api/live/calendar", 60_000);
  const { data: messagesData } = useLive<{ messages: LiveMessage[] }>("/api/live/messages", 30_000);
  const { data: notificationsData } = useLive<{ notifications: LiveNotification[] }>(
    "/api/live/notifications",
    5 * 60_000,
  );
  const [front, setFront] = useState(0);
  const { ref: glowRef, onPointerMove: glowMove, onPointerLeave: glowLeave } = usePointerGlow<HTMLButtonElement>();

  const items: ActivityItem[] = [
    ...(messagesData?.messages ?? []).slice(0, 2).map(
      (m): ActivityItem => ({ kind: "message", id: m.id, author: m.author, channel: m.channel, text: m.text }),
    ),
    ...(calendarData?.events ?? []).slice(0, 2).map(
      (e): ActivityItem => ({
        kind: "calendar",
        id: e.id,
        title: e.title,
        when: formatEventWhen(e),
        allDay: e.allDay,
        location: e.location,
      }),
    ),
    ...(notificationsData?.notifications ?? []).map(
      (n): ActivityItem => ({ kind: "social", id: n.id, title: n.title, subtitle: n.subtitle, date: n.date }),
    ),
  ];

  if (items.length === 0) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
        <Cake className="h-5 w-5" style={{ color: "var(--ink-soft)" }} />
        <p className="max-w-[240px] text-xs" style={{ color: "var(--ink-soft)" }}>
          Nothing needs your attention yet — connect an account in Settings to see live activity here.
        </p>
      </div>
    );
  }

  const frontIndex = front % items.length;
  const layers = items.length <= 3 ? items.length : 3;

  function advance() {
    setFront((f) => (f + 1) % items.length);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-52 w-full max-w-sm" style={{ perspective: 800 }}>
        <AnimatePresence initial={false}>
          {Array.from({ length: layers })
            .map((_, depth) => depth)
            .reverse()
            .map((depth) => {
              const item = items[(frontIndex + depth) % items.length];
              const isFront = depth === 0;
              const style = CARD_STYLE[item.kind];

              if (!isFront) {
                // Back layers are deliberately content-free, opaque color
                // chips — a translucent glass card here would let their text
                // show through the front card and read as garbled ghosting.
                return (
                  <motion.div
                    key={`${item.kind}-${item.id}-${frontIndex}-back`}
                    initial={false}
                    animate={{
                      y: depth * 10,
                      x: depth % 2 === 0 ? depth * 6 : depth * -6,
                      scale: 1 - depth * 0.07,
                      rotate: depth % 2 === 0 ? 3 : -3,
                      opacity: 0.9 - depth * 0.15,
                    }}
                    exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    style={{ zIndex: layers - depth, background: style.gradient }}
                    className="absolute inset-x-0 top-0 h-44 rounded-[28px] shadow-lg"
                    aria-hidden="true"
                  />
                );
              }

              return (
                <motion.button
                  key={`${item.kind}-${item.id}-${frontIndex}`}
                  ref={glowRef}
                  onPointerMove={glowMove}
                  onPointerLeave={glowLeave}
                  onClick={advance}
                  initial={false}
                  animate={{ y: 0, x: 0, scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ y: -40, x: 24, opacity: 0, scale: 0.92, rotate: 6, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97, rotate: -1 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  style={{ zIndex: layers }}
                  className="glass-strong absolute inset-x-0 top-0 flex h-44 flex-col gap-2 overflow-hidden p-5 text-left"
                >
                  <div className="glow-overlay" aria-hidden="true" />
                  <div className="relative z-10 flex flex-1 flex-col gap-2">
                    <ActivityCardContent item={item} />
                  </div>
                </motion.button>
              );
            })}
        </AnimatePresence>
      </div>

      {items.length > 1 && (
        <div className="flex items-center gap-2">
          {items.map((item, i) => (
            <motion.button
              key={`${item.kind}-${item.id}`}
              onClick={() => setFront(i)}
              whileHover={{ scale: 1.3 }}
              whileTap={{ scale: 0.9 }}
              className="h-1.5 rounded-full"
              animate={{ width: i === frontIndex ? 16 : 6 }}
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
              style={{
                background: i === frontIndex ? "var(--accent)" : "var(--glass-border)",
              }}
              aria-label={`Show item ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityCardContent({ item }: { item: ActivityItem }) {
  const style = CARD_STYLE[item.kind];

  if (item.kind === "message") {
    const initial = item.author.trim().charAt(0).toUpperCase() || "?";
    return (
      <>
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
            style={{ background: style.gradient, color: style.ink }}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
              New message from {item.author}
            </p>
            <p className="truncate text-xs" style={{ color: "var(--ink-soft)" }}>
              {item.channel}
            </p>
          </div>
        </div>
        <p className="line-clamp-2 text-sm leading-snug" style={{ color: "var(--ink)" }}>
          {item.text}
        </p>
        <span className="mt-auto flex items-center gap-1 self-end text-xs" style={{ color: "var(--accent)" }}>
          Next <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </>
    );
  }

  if (item.kind === "calendar") {
    return (
      <>
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: style.gradient, color: style.ink }}
          >
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {item.title}
            </p>
            <p className="flex items-center gap-1 text-xs" style={{ color: "var(--ink-soft)" }}>
              <Clock className="h-3 w-3" /> {item.when}
            </p>
          </div>
        </div>
        {item.location && (
          <p className="flex items-center gap-1 text-xs" style={{ color: "var(--ink-soft)" }}>
            <MapPin className="h-3 w-3" /> {item.location}
          </p>
        )}
        <span className="mt-auto flex items-center gap-1 self-end text-xs" style={{ color: "var(--accent)" }}>
          Next <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: style.gradient, color: style.ink }}
        >
          <Cake className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {item.title}
          </p>
          <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
            {new Date(item.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            {item.subtitle ? ` · ${item.subtitle}` : ""}
          </p>
        </div>
      </div>
      <span className="mt-auto flex items-center gap-1 self-end text-xs" style={{ color: "var(--accent)" }}>
        Next <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </>
  );
}
