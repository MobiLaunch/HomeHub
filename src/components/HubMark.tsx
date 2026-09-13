"use client";

import { motion } from "framer-motion";

/**
 * Abstract four-tile mark — echoes the dashboard's own tile grid, one tile
 * per M3 tonal color role (primary/secondary/tertiary/error), the same
 * multi-hue "expressive" mix Google's own product marks use.
 */
export function HubMark({ size = 72 }: { size?: number }) {
  const tiles = [
    { x: 0, y: 0, delay: 0, color: "var(--m3-primary)" },
    { x: 1, y: 0, delay: 0.08, color: "var(--m3-secondary)" },
    { x: 0, y: 1, delay: 0.16, color: "var(--m3-tertiary)" },
    { x: 1, y: 1, delay: 0.24, color: "var(--m3-error)" },
  ];
  const gap = size * 0.12;
  const tile = (size - gap) / 2;

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      {tiles.map((t, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.4, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: t.delay, type: "spring", stiffness: 260, damping: 16 }}
          style={{
            position: "absolute",
            width: tile,
            height: tile,
            left: t.x * (tile + gap),
            top: t.y * (tile + gap),
            borderRadius: size * 0.22,
            background: t.color,
          }}
        />
      ))}
    </div>
  );
}
