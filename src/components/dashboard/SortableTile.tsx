"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tile } from "@/components/dashboard/Tile";
import type { TileSize } from "@/hooks/useDashboardLayout";

const SIZE_SPAN: Record<TileSize, string> = {
  sm: "",
  md: "",
  lg: "sm:col-span-2",
  xl: "sm:col-span-2 lg:col-span-3",
};

/**
 * The dnd-kit sortable wrapper — a plain div that owns the grid placement
 * (column span) and the drag transform, one level outside Tile itself.
 * Keeping the span/transform here (not inside Tile's own motion.section)
 * means dnd-kit's drag transform and framer-motion's `layout` animation
 * each control a different element, so they don't fight over the same
 * `transform` style.
 */
export function SortableTile({
  id,
  size,
  ...tileProps
}: {
  id: string;
  size: TileSize;
} & Omit<Parameters<typeof Tile>[0], "size" | "isDragging" | "dragHandleProps">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !tileProps.customizing,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={SIZE_SPAN[size]}
    >
      <Tile {...tileProps} size={size} isDragging={isDragging} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}
