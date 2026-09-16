"use client";

import { useCallback, useEffect, useState } from "react";
import { useTileActivitySnapshot } from "@/hooks/useTileActivity";

export type TileSize = "sm" | "md" | "lg" | "xl";
export type TilePref = { tileType: string; enabled: boolean; position: number; size: TileSize };
export type DisplayTile = TilePref & { boostSize: boolean };

/**
 * Owns the dashboard's layout state: which tiles are enabled, their saved
 * order/size, and a "customizing" mode that pauses the live activity-based
 * reorder/boost (see useTileActivity) so a drag gesture isn't fighting a
 * tile that's simultaneously resorting itself. Reorder/resize both apply
 * optimistically, then persist to /api/tiles.
 */
export function useDashboardLayout() {
  const [tiles, setTiles] = useState<TilePref[] | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const activity = useTileActivitySnapshot();

  useEffect(() => {
    fetch("/api/tiles")
      .then((r) => r.json())
      .then((json) => setTiles(json.tiles));
  }, []);

  const visible = (tiles ?? []).filter((t) => t.enabled).sort((a, b) => a.position - b.position);

  // While customizing, show the tiles in their plain saved order/size — no
  // live activity resorting, so a tile doesn't jump out from under a drag.
  const displayTiles: DisplayTile[] = customizing
    ? visible.map((t) => ({ ...t, boostSize: false }))
    : visible
        .map((t) => ({ ...t, ...(activity[t.tileType] ?? { score: 0, boostSize: false }) }))
        .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.position - b.position));

  const reorder = useCallback(async (order: string[]) => {
    setTiles((prev) => {
      if (!prev) return prev;
      const positionOf = new Map(order.map((tileType, i) => [tileType, i]));
      return prev.map((t) => (positionOf.has(t.tileType) ? { ...t, position: positionOf.get(t.tileType)! } : t));
    });
    await fetch("/api/tiles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    });
  }, []);

  const resize = useCallback(async (tileType: string, size: TileSize) => {
    setTiles((prev) => (prev ? prev.map((t) => (t.tileType === tileType ? { ...t, size } : t)) : prev));
    await fetch("/api/tiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tileType, size }),
    });
  }, []);

  return { tiles, displayTiles, customizing, setCustomizing, reorder, resize };
}
