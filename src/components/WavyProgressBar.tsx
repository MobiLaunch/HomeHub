"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { spatial } from "@/lib/motion";

// Must stay in sync with the wavy-progress-flow keyframe in globals.css,
// which translates by exactly one wavelength (VIEW_WIDTH / WAVE_COUNT).
const WAVE_COUNT = 6;
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 8;
const AMPLITUDE = 1.6;
const SAMPLES_PER_WAVE = 10;

/** Two copies of the wave pattern side by side — since it's periodic, this
 * makes it seamlessly tileable when the CSS animation slides it left by
 * exactly one wavelength and loops. */
function buildWavePath() {
  const copies = 2;
  const totalWidth = VIEW_WIDTH * copies;
  const totalSamples = WAVE_COUNT * copies * SAMPLES_PER_WAVE;
  const midY = VIEW_HEIGHT / 2;
  let d = "";
  for (let i = 0; i <= totalSamples; i++) {
    const x = (i / totalSamples) * totalWidth;
    const angle = (i / SAMPLES_PER_WAVE) * Math.PI * 2;
    const y = midY + Math.sin(angle) * AMPLITUDE;
    d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

const WAVE_D = buildWavePath();

/**
 * M3 Expressive's signature wavy linear progress indicator. The filled
 * portion ripples continuously while `active` (a spring morphs the
 * amplitude in), and flattens to a plain straight line when paused/idle —
 * the same "resting, not gone" treatment Google uses for a stalled process.
 */
export function WavyProgressBar({
  progress,
  active,
  onSeek,
  className,
}: {
  /** 0..1 */
  progress: number;
  active: boolean;
  onSeek?: (fraction: number) => void;
  className?: string;
}) {
  const clipId = useId();
  const pct = Math.min(1, Math.max(0, progress)) * 100;
  const midY = VIEW_HEIGHT / 2;

  const track = (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className="h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={-4} width={pct} height={VIEW_HEIGHT + 8} />
        </clipPath>
      </defs>
      <line
        x1={0}
        y1={midY}
        x2={VIEW_WIDTH}
        y2={midY}
        stroke="var(--glass-fill-strong)"
        strokeWidth={VIEW_HEIGHT * 0.5}
        strokeLinecap="round"
      />
      <g clipPath={`url(#${clipId})`}>
        <motion.g
          style={{ transformOrigin: `0px ${midY}px` }}
          animate={{ scaleY: active ? 1 : 0.015 }}
          transition={spatial.default}
        >
          <path
            d={WAVE_D}
            vectorEffect="non-scaling-stroke"
            fill="none"
            stroke="var(--accent)"
            strokeWidth={VIEW_HEIGHT * 0.5}
            strokeLinecap="round"
            className={active ? "wavy-progress-flow" : undefined}
          />
        </motion.g>
      </g>
    </svg>
  );

  if (!onSeek) {
    return <div className={`block h-2 w-full ${className ?? ""}`}>{track}</div>;
  }

  return (
    <button
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
      }}
      aria-label="Seek"
      className={`block h-2 w-full cursor-pointer ${className ?? ""}`}
    >
      {track}
    </button>
  );
}
