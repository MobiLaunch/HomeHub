"use client";

import { Bell, Cake } from "lucide-react";
import { useLive } from "@/hooks/useLive";
import type { LiveNotification } from "@/lib/integrations/live";

export function NotificationsTile() {
  const { data, isLoading } = useLive<{ notifications: LiveNotification[] }>(
    "/api/live/notifications",
    5 * 60_000,
  );
  const notifications = data?.notifications ?? [];

  if (isLoading && notifications.length === 0) {
    return <EmptyState text="Checking for reminders…" />;
  }
  if (notifications.length === 0) {
    return <EmptyState text="Nothing to celebrate yet — or Facebook isn't connected." />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {notifications.map((notification) => (
        <li
          key={notification.id}
          className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
          style={{ background: "var(--glass-fill-strong)" }}
        >
          <Cake className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" style={{ color: "var(--ink)" }}>
              {notification.title}
            </p>
            <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
              {new Date(notification.date).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              {notification.subtitle ? ` · ${notification.subtitle}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
      <Bell className="h-5 w-5" style={{ color: "var(--ink-soft)" }} />
      <p className="max-w-[220px] text-xs" style={{ color: "var(--ink-soft)" }}>
        {text}
      </p>
    </div>
  );
}
