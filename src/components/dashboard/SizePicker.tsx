"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { spatial } from "@/lib/motion";
import type { TileSize } from "@/hooks/useDashboardLayout";

const SIZES: { value: TileSize; label: string; icon: string }[] = [
  { value: "sm", label: "Compact", icon: "crop_square" },
  { value: "md", label: "Standard", icon: "crop_5_4" },
  { value: "lg", label: "Wide", icon: "crop_landscape" },
  { value: "xl", label: "Large", icon: "crop_free" },
];

/** A small popover of size presets — Compact/Standard/Wide/Large — shown
 * while a tile is being customized. Discrete presets rather than a live
 * drag-resize gesture, per the dashboard's "supported size presets" model. */
export function SizePicker({
  value,
  onPick,
  onClose,
}: {
  value: TileSize;
  onPick: (size: TileSize) => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -6 }}
        transition={spatial.fast}
        className="glass-strong absolute right-0 top-full z-20 mt-2 flex flex-col gap-1 p-2"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {SIZES.map((s) => (
          <button
            key={s.value}
            onClick={() => {
              onPick(s.value);
              onClose();
            }}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-left"
            style={{
              background: s.value === value ? "var(--accent-soft)" : "transparent",
              color: s.value === value ? "var(--m3-on-primary-container)" : "var(--ink)",
            }}
          >
            <Icon name={s.icon} className="h-4 w-4" style={{ color: s.value === value ? "var(--accent)" : "var(--ink-soft)" }} />
            <span className="m3-label-large whitespace-nowrap">{s.label}</span>
            {s.value === value && <Icon name="check" className="ml-auto h-4 w-4" style={{ color: "var(--accent)" }} />}
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
