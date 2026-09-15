"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import { Badge } from "@/components/Badge";
import { spatial } from "@/lib/motion";

export function Tile({ title, icon, size = "md", index = 0, children, action, active = false }: {
  title: string;
  icon: ReactNode;
  size?: "sm" | "md" | "lg";
  index?: number;
  children: ReactNode;
  action?: ReactNode;
  active?: boolean;
}) {
  const { ref, onPointerMove, onPointerLeave } = usePointerGlow<HTMLElement>();
  return (
    <motion.section
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ layout: spatial.default, default: { duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] } }}
      style={{ boxShadow: active ? "0 0 0 2px var(--accent), var(--elevation-2)" : undefined }}
      className={`glass glow flex flex-col p-5 ${size === "lg" ? "sm:col-span-2" : ""}`}
    >
      <header className="relative z-10 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.span style={{ color: "var(--accent)" }} whileHover={{ rotate: 8, scale: 1.12 }} transition={{ type: "spring", stiffness: 400, damping: 12 }}>{icon}</motion.span>
          <h2 className="m3-title-medium" style={{ color: "var(--ink)" }}>{title}</h2>
          <Badge visible={active} />
        </div>
        {action}
      </header>
      <div className="relative z-10 flex-1">{children}</div>
    </motion.section>
  );
}
