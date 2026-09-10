"use client";

import { motion } from "framer-motion";

/** Abstract four-tile mark — echoes the dashboard's own tile grid. */
export function HubMark({ size = 72 }: { size?: number }) {
  const tiles = [
    { x: 0, y: 0, delay: 0 },
    { x: 1, y: 0, delay: 0.08 },
    { x: 0, y: 1, delay: 0.16 },
    { x: 1, y: 1, delay: 0.24 },
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
          transition={{ delay: t.delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="glass-strong"
          style={{
            position: "absolute",
            width: tile,
            height: tile,
            left: t.x * (tile + gap),
            top: t.y * (tile + gap),
            background:
              i === 0
                ? "linear-gradient(135deg, var(--accent), #9c9bff)"
                : undefined,
          }}
        />
      ))}
    </div>
  );
}
