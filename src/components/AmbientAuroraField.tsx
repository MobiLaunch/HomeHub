"use client";

import { useEffect, useState } from "react";
import { useAmbientColor } from "@/hooks/useAmbientColor";

type TimeTint = { background: string; opacity: number };

const NIGHT: TimeTint = { background: "radial-gradient(ellipse at 50% 100%, rgba(255, 158, 87, 0.9), transparent 65%)", opacity: 0.1 };
const DAWN: TimeTint = { background: "radial-gradient(ellipse at 50% 0%, rgba(140, 190, 255, 0.9), transparent 65%)", opacity: 0.06 };
const DUSK: TimeTint = { background: "radial-gradient(ellipse at 50% 100%, rgba(255, 138, 101, 0.9), transparent 65%)", opacity: 0.07 };
const DAY: TimeTint = { background: "transparent", opacity: 0 };

function tintForHour(hour: number): TimeTint {
  if (hour >= 22 || hour < 5) return NIGHT;
  if (hour >= 5 && hour < 8) return DAWN;
  if (hour >= 17 && hour < 22) return DUSK;
  return DAY;
}

/**
 * The app-wide background wash: the two slow-drifting color blobs (still
 * plain CSS, unchanged) plus two JS-driven layers — a time-of-day warmth
 * wash and an album-art-derived glow reported by whatever's currently
 * playing (see useAmbientColor). Both stay deliberately subtle; this is
 * meant to feel like ambient light, not a visualizer.
 */
export function AmbientAuroraField() {
  const albumRgb = useAmbientColor();
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 15 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const timeTint = tintForHour(hour);

  return (
    <div className="aurora-field" aria-hidden="true">
      <div className="aurora-field-time" style={{ background: timeTint.background, opacity: timeTint.opacity }} />
      <div
        className="aurora-field-ambient"
        style={{
          opacity: albumRgb ? 0.26 : 0,
          background: albumRgb ? `radial-gradient(circle, rgba(${albumRgb}, 0.85), transparent 70%)` : undefined,
        }}
      />
    </div>
  );
}
