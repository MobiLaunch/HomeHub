"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useRipple } from "@/hooks/useRipple";

/** M3 switch: track fills with the accent color and the thumb grows with a
 * checkmark when on, per Material 3's switch spec. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  const { onPointerDown, rippleLayer } = useRipple<HTMLButtonElement>();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      onPointerDown={onPointerDown}
      className="ripple-surface relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full p-1"
      style={{
        background: checked ? "var(--accent)" : "var(--surface-pill)",
        border: `2px solid ${checked ? "var(--accent)" : "var(--outline)"}`,
        transition: "background-color 0.2s ease, border-color 0.2s ease",
      }}
    >
      {rippleLayer}
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="flex items-center justify-center rounded-full"
        style={{
          width: checked ? 22 : 14,
          height: checked ? 22 : 14,
          marginLeft: checked ? "auto" : 0,
          background: checked ? "var(--on-accent)" : "var(--outline)",
        }}
      >
        {checked && <Icon name="check" className="h-3 w-3" weight={700} style={{ color: "var(--accent)" }} />}
      </motion.span>
    </button>
  );
}
