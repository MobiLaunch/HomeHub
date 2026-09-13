"use client";

import { useCallback, useState, type PointerEvent, type ReactNode } from "react";

type RippleInstance = { id: number; x: number; y: number; size: number };
const RIPPLE_LIFETIME_MS = 650;

/**
 * M3 state-layer ripple: an expanding, fading circle from the pointer-down
 * point. The host element needs `position: relative; overflow: hidden` (the
 * `.ripple-surface` class provides both) so the circle clips to its shape.
 */
export function useRipple<T extends HTMLElement = HTMLButtonElement>() {
  const [ripples, setRipples] = useState<RippleInstance[]>([]);

  const onPointerDown = useCallback((e: PointerEvent<T>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();
    const ripple: RippleInstance = {
      id,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      size: Math.max(rect.width, rect.height) * 1.8,
    };
    setRipples((prev) => [...prev, ripple]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), RIPPLE_LIFETIME_MS);
  }, []);

  const rippleLayer: ReactNode = (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {ripples.map((r) => (
        <span
          key={r.id}
          className="ripple-circle"
          style={{ left: r.x - r.size / 2, top: r.y - r.size / 2, width: r.size, height: r.size }}
        />
      ))}
    </span>
  );

  return { onPointerDown, rippleLayer };
}
