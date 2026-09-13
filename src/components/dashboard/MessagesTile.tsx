"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useLive } from "@/hooks/useLive";
import type { LiveMessage } from "@/lib/integrations/live";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function MessagesTile() {
  const { data, isLoading } = useLive<{ messages: LiveMessage[] }>("/api/live/messages", 30_000);
  const messages = data?.messages ?? [];

  if (isLoading && messages.length === 0) {
    return <EmptyState text="Checking Slack & Teams…" />;
  }
  if (messages.length === 0) {
    return <EmptyState text="No recent messages — or nothing connected yet." />;
  }

  return (
    <ul className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {messages.slice(0, 6).map((message, i) => (
          <motion.li
            key={message.id}
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
            whileHover={{ x: 3, background: "var(--glass-fill)" }}
            className="rounded-2xl px-3 py-2.5"
            style={{ background: "var(--glass-fill-strong)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium" style={{ color: "var(--ink)" }}>
                {message.author} · <span style={{ color: "var(--ink-soft)" }}>{message.channel}</span>
              </span>
              <span className="shrink-0 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                {timeAgo(message.timestamp)}
              </span>
            </div>
            <p className="truncate text-xs" style={{ color: "var(--ink-soft)" }}>
              {message.text}
            </p>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center"
    >
      <Icon name="forum" className="h-5 w-5" style={{ color: "var(--ink-soft)" }} />
      <p className="max-w-[220px] text-xs" style={{ color: "var(--ink-soft)" }}>
        {text}
      </p>
    </motion.div>
  );
}
