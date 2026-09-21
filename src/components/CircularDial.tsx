"use client";

import { useRef } from "react";

const SWEEP_DEG = 270;
const START_DEG = 225; // clockwise from 12 o'clock; leaves a 90° gap centered at the bottom
const TRACK_WIDTH = 8;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const sweep = ((endDeg - startDeg) % 360 + 360) % 360;
  const largeArcFlag = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

/** Clamps an arbitrary clockwise-from-top angle into the dial's valid sweep, snapping to whichever end is nearer when the pointer strays into the gap. */
function clampAngleToSweep(angleDeg: number): number {
  const relative = ((angleDeg - START_DEG) % 360 + 360) % 360;
  if (relative <= SWEEP_DEG) return relative;
  const distanceToStart = relative - SWEEP_DEG;
  const distanceToEnd = 360 - relative;
  return distanceToStart < distanceToEnd ? SWEEP_DEG : 0;
}

/**
 * A drag/tap radial control mapping a value in [min, max] onto a ~270°
 * gauge, the smart-home-kit's signature temperature dial generalized into
 * a shared primitive. Pointer-driven (drag anywhere on the ring, or tap a
 * point on the track to jump there), independent of what the value means.
 */
export function CircularDial({
  value,
  min,
  max,
  step = 1,
  onChange,
  size = 200,
  label,
  active = true,
  children,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  size?: number;
  label?: string;
  active?: boolean;
  children?: React.ReactNode;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  const radius = size / 2 - TRACK_WIDTH;
  const center = size / 2;
  const fraction = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const valueAngle = START_DEG + fraction * SWEEP_DEG;
  const handle = polarToCartesian(center, center, radius, valueAngle);

  function angleFromPointer(clientX: number, clientY: number): number {
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = size / rect.width;
    const x = (clientX - rect.left) * scale - center;
    const y = (clientY - rect.top) * scale - center;
    const angleDeg = (Math.atan2(x, -y) * 180) / Math.PI;
    return clampAngleToSweep(((angleDeg % 360) + 360) % 360);
  }

  function applyAngle(clientX: number, clientY: number) {
    const angle = angleFromPointer(clientX, clientY);
    const rawValue = min + (angle / SWEEP_DEG) * (max - min);
    const stepped = Math.round(rawValue / step) * step;
    onChange(Math.min(max, Math.max(min, stepped)));
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    applyAngle(e.clientX, e.clientY);
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!draggingRef.current) return;
    applyAngle(e.clientX, e.clientY);
  }
  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    draggingRef.current = false;
    (e.target as Element).releasePointerCapture(e.pointerId);
  }

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        ref={svgRef}
        width={size}
        height={size}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        className="rounded-full outline-none focus-visible:ring-2"
        style={{ touchAction: "none", cursor: "pointer", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange(Math.min(max, value + step));
          if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange(Math.max(min, value - step));
        }}
      >
        <path
          d={describeArc(center, center, radius, START_DEG, START_DEG + SWEEP_DEG)}
          fill="none"
          stroke="var(--surface-pill)"
          strokeWidth={TRACK_WIDTH}
          strokeLinecap="round"
        />
        {fraction > 0 && (
          <path
            d={describeArc(center, center, radius, START_DEG, valueAngle)}
            fill="none"
            stroke={active ? "var(--accent)" : "var(--ink-soft)"}
            strokeWidth={TRACK_WIDTH}
            strokeLinecap="round"
          />
        )}
        <circle
          cx={handle.x}
          cy={handle.y}
          r={TRACK_WIDTH + 2}
          fill={active ? "var(--accent)" : "var(--ink-soft)"}
          stroke="var(--surface-card)"
          strokeWidth={3}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
