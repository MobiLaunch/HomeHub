"use client";

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import { Badge } from "@/components/Badge";
import { Icon } from "@/components/Icon";
import { SizePicker } from "@/components/dashboard/SizePicker";
import { spatial } from "@/lib/motion";
import type { TileSize } from "@/hooks/useDashboardLayout";

const SIZE_MIN_HEIGHT: Record<TileSize, string> = {
  sm: "min-h-[160px]",
  md: "min-h-[220px]",
  lg: "min-h-[220px]",
  xl: "min-h-[380px]",
};

export function Tile({
  title,
  icon,
  size = "md",
  index = 0,
  children,
  action,
  active = false,
  customizing = false,
  dragHandleProps,
  isDragging = false,
  onResize,
  layoutId,
  isExpanded = false,
  onExpand,
}: {
  title: string;
  icon: ReactNode;
  size?: TileSize;
  index?: number;
  children: ReactNode;
  action?: ReactNode;
  /** Shows an attention dot and a subtle accent ring — set when this tile's
   * live activity score earned it a boosted spot/size in the grid. */
  active?: boolean;
  /** Dashboard is in edit mode: shows a drag handle + resize picker instead
   * of the tile's own content interactions. */
  customizing?: boolean;
  /** Spread onto the drag handle button (dnd-kit's listeners/attributes). */
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  onResize?: (size: TileSize) => void;
  /** Shared with ExpandedTileOverlay so framer-motion can morph between
   * this grid tile and the full-surface expanded view. */
  layoutId?: string;
  /** This tile's expanded twin is currently showing — hide this one's
   * content (the overlay is the only copy actually rendering it) while
   * still occupying its grid slot so the collapse animation has somewhere
   * to land. */
  isExpanded?: boolean;
  onExpand?: () => void;
}) {
  const { ref, onPointerMove, onPointerLeave } = usePointerGlow<HTMLElement>();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <motion.section
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      layout
      layoutId={layoutId}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: isExpanded ? 0 : isDragging ? 0.25 : 1, y: 0, scale: 1 }}
      transition={{ layout: spatial.default, default: { duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] } }}
      style={{
        boxShadow: active && !isDragging ? "0 0 0 2px var(--accent), var(--elevation-2)" : undefined,
        outline: customizing ? "2px dashed var(--outline)" : undefined,
        outlineOffset: customizing ? "2px" : undefined,
      }}
      className={`glass glow relative flex h-full flex-col p-5 ${SIZE_MIN_HEIGHT[size]}`}
    >
      <header className="relative z-10 mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onExpand}
          disabled={!onExpand || customizing}
          className="flex min-w-0 items-center gap-2 text-left disabled:cursor-default"
          aria-label={onExpand && !customizing ? `Expand ${title}` : undefined}
        >
          <motion.span style={{ color: "var(--accent)" }} whileHover={{ rotate: 8, scale: 1.12 }} transition={{ type: "spring", stiffness: 400, damping: 12 }}>{icon}</motion.span>
          <h2 className="m3-title-medium truncate" style={{ color: "var(--ink)" }}>{title}</h2>
          <Badge visible={active} />
        </button>
        {customizing ? (
          <div className="relative flex shrink-0 items-center gap-1">
            <button
              onClick={() => setPickerOpen((o) => !o)}
              aria-label={`Resize ${title}`}
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "var(--glass-fill-strong)" }}
            >
              <Icon name="aspect_ratio" className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
            </button>
            <button
              {...dragHandleProps}
              aria-label={`Drag to reorder ${title}`}
              className="flex h-8 w-8 cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
              style={{ background: "var(--glass-fill-strong)", touchAction: "none" }}
            >
              <Icon name="drag_indicator" className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
            </button>
            {pickerOpen && onResize && (
              <SizePicker value={size} onPick={onResize} onClose={() => setPickerOpen(false)} />
            )}
          </div>
        ) : (
          action
        )}
      </header>
      <div className={`relative z-10 flex-1 ${customizing ? "pointer-events-none select-none opacity-70" : ""}`}>
        {/* The expanded overlay is the only live copy of this widget while
            it's open (see ExpandedTileOverlay) — not rendering `children`
            here too avoids a second simultaneous instance (duplicate data
            fetches, duplicate subscriptions) sitting underneath, invisible
            but still running. */}
        {isExpanded ? null : children}
      </div>
    </motion.section>
  );
}
