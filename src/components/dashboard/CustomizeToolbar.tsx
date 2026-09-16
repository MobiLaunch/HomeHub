"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { spatial } from "@/lib/motion";

/** Floating bar shown while the dashboard is in customize mode — replaces
 * the quick-add FAB for the duration, so there's only ever one floating
 * action on screen at a time. */
export function CustomizeToolbar({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.9 }}
      transition={spatial.default}
      className="glass-strong fixed inset-x-4 bottom-6 z-50 flex items-center gap-3 px-4 py-3 sm:inset-x-auto sm:right-6"
    >
      <Icon name="drag_indicator" className="hidden h-4 w-4 shrink-0 sm:block" style={{ color: "var(--ink-soft)" }} />
      <span className="m3-label-large hidden min-w-0 flex-1 sm:block" style={{ color: "var(--ink-soft)" }}>
        Drag to reorder, tap <Icon name="aspect_ratio" className="inline h-3.5 w-3.5 align-[-2px]" /> to resize
      </span>
      <span className="m3-label-large flex-1 sm:hidden" style={{ color: "var(--ink-soft)" }}>
        Customizing
      </span>
      <button
        onClick={onDone}
        className="shrink-0 rounded-full px-4 py-1.5"
        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
      >
        <span className="m3-label-large">Done</span>
      </button>
    </motion.div>
  );
}
