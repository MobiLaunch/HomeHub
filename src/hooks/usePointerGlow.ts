"use client";

import { useCallback, useRef } from "react";

/**
 * Tracks pointer position over an element and writes it as CSS custom
 * properties (--glow-x/--glow-y/--glow-o), which the `.glow` class in
 * globals.css turns into a cursor-following specular highlight. Reads
 * getBoundingClientRect on every move rather than via React state so the
 * highlight tracks the cursor at native pointer-event frequency with no
 * re-renders.
 */
export function usePointerGlow<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--glow-x", `${x}%`);
    el.style.setProperty("--glow-y", `${y}%`);
    el.style.setProperty("--glow-o", "1");
  }, []);

  const onPointerLeave = useCallback(() => {
    ref.current?.style.setProperty("--glow-o", "0");
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
