"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { spatial, effects } from "@/lib/motion";

/**
 * The "expand" half of the tile's shared-layout transition: shares a
 * `layoutId` with the grid Tile it opened from (see Tile.tsx), so
 * framer-motion morphs between the two automatically — the tile visually
 * grows into this full surface rather than a new screen appearing. Only
 * ever rendered (mounted) while its Tile counterpart is hidden, so there's
 * exactly one live copy of the widget's content at a time.
 *
 * Portaled to document.body: nesting a `position: fixed` element inside a
 * framer-motion-animated ancestor changes its containing block (any
 * `transform` in the chain does), which would otherwise break this overlay's
 * fixed positioning the same way it did for NewEventForm/EventDetailSheet.
 */
export function ExpandedTileOverlay({
  layoutId,
  title,
  icon,
  onClose,
  children,
}: {
  layoutId: string;
  title: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={effects.default}
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.35)" }}
        aria-hidden="true"
      />
      <motion.section
        layoutId={layoutId}
        transition={spatial.default}
        className="glass-strong fixed inset-4 z-50 flex flex-col overflow-hidden p-6 sm:inset-x-[8%] sm:inset-y-[6%]"
        style={{ boxShadow: "var(--elevation-3)" }}
      >
        <header className="mb-4 flex shrink-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span style={{ color: "var(--accent)" }}>{icon}</span>
            <h2 className="m3-headline-small truncate" style={{ color: "var(--ink)" }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--glass-fill-strong)" }}
          >
            <Icon name="close" className="h-5 w-5" style={{ color: "var(--ink-soft)" }} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </motion.section>
    </>,
    document.body,
  );
}
