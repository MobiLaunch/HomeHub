"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Tile({
  title,
  icon,
  size = "md",
  children,
  action,
}: {
  title: string;
  icon: ReactNode;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`glass flex flex-col p-5 ${size === "lg" ? "sm:col-span-2" : ""}`}
    >
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--accent)" }}>{icon}</span>
          <h2 className="text-sm font-semibold tracking-wide" style={{ color: "var(--ink)" }}>
            {title}
          </h2>
        </div>
        {action}
      </header>
      <div className="flex-1">{children}</div>
    </motion.section>
  );
}
