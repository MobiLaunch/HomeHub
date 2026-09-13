"use client";

import { motion } from "framer-motion";
import { Users, Eye, Sparkles, UserPlus, ThumbsUp } from "lucide-react";
import { useLive } from "@/hooks/useLive";
import type { FacebookPageInsights } from "@/lib/integrations/live";

const STATS: {
  key: keyof Pick<FacebookPageInsights, "followers" | "impressions28d" | "engagedUsers28d" | "newFollowers28d">;
  label: string;
  icon: typeof Users;
}[] = [
  { key: "followers", label: "Followers", icon: Users },
  { key: "impressions28d", label: "Impressions (28d)", icon: Eye },
  { key: "engagedUsers28d", label: "Engaged (28d)", icon: Sparkles },
  { key: "newFollowers28d", label: "New followers (28d)", icon: UserPlus },
];

function formatStat(value: number | null) {
  if (value === null) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

export function FacebookInsightsTile() {
  const { data, isLoading } = useLive<{ insights: FacebookPageInsights[] }>(
    "/api/live/facebook-insights",
    5 * 60_000,
  );
  const page = data?.insights?.[0];

  if (isLoading && !page) {
    return <EmptyState text="Checking your Facebook Page…" />;
  }
  if (!page) {
    return <EmptyState text="Connect your Facebook Page in Settings to see its stats here." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="truncate text-sm font-medium" style={{ color: "var(--ink)" }}>
        {page.pageName}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="flex flex-col gap-1 rounded-2xl px-3 py-2.5"
              style={{ background: "var(--glass-fill-strong)" }}
            >
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                <Icon className="h-3 w-3" /> {stat.label}
              </span>
              <span className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
                {formatStat(page[stat.key])}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center"
    >
      <ThumbsUp className="h-5 w-5" style={{ color: "var(--ink-soft)" }} />
      <p className="max-w-[220px] text-xs" style={{ color: "var(--ink-soft)" }}>
        {text}
      </p>
    </motion.div>
  );
}
