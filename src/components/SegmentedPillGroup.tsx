"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useRipple } from "@/hooks/useRipple";

export type SegmentedPillOption<T extends string> = { value: T; label: string; icon?: string };

/**
 * A pill-tab row with a sliding active background — the kit's mode-selector
 * pattern (also what CalendarTile's Agenda/Week/Month/Year switcher already
 * did ad hoc), generalized so any tile can reuse it. Each instance gets its
 * own layoutId namespace via useId() so multiple groups on one page don't
 * cross-animate into each other.
 */
export function SegmentedPillGroup<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: SegmentedPillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const groupId = useId();
  return (
    <div className={`glass-pill relative inline-flex max-w-full overflow-x-auto p-1 ${className}`}>
      {options.map((option) => (
        <SegmentedPillOptionButton
          key={option.value}
          groupId={groupId}
          active={value === option.value}
          label={option.label}
          icon={option.icon}
          onSelect={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}

function SegmentedPillOptionButton({ groupId, active, label, icon, onSelect }: {
  groupId: string;
  active: boolean;
  label: string;
  icon?: string;
  onSelect: () => void;
}) {
  const { onPointerDown, rippleLayer } = useRipple<HTMLButtonElement>();
  return (
    <button
      onClick={onSelect}
      onPointerDown={onPointerDown}
      className="ripple-surface relative flex min-h-8 shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium"
      style={{ color: active ? "var(--on-accent)" : "var(--ink-soft)" }}
    >
      {active && (
        <motion.span
          layoutId={`segmented-active-${groupId}`}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="absolute inset-0 rounded-full"
          style={{ background: "var(--accent)" }}
        />
      )}
      {rippleLayer}
      {icon && <Icon name={icon} className="relative h-3.5 w-3.5" />}
      <span className="relative">{label}</span>
    </button>
  );
}
