"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type TileActivity = { score: number; boostSize: boolean };

type ActivityMap = Record<string, TileActivity>;

const TileActivityContext = createContext<{
  activity: ActivityMap;
  report: (tileType: string, next: TileActivity) => void;
} | null>(null);

/**
 * Lets dashboard tiles report their own "how busy am I right now" signal
 * up to the grid without lifting each tile's data-fetching into the parent.
 * The grid reads the resulting snapshot to reorder/resize tiles live.
 */
export function TileActivityProvider({ children }: { children: ReactNode }) {
  const [activity, setActivity] = useState<ActivityMap>({});

  const report = useCallback((tileType: string, next: TileActivity) => {
    setActivity((prev) => {
      const current = prev[tileType];
      if (current && current.score === next.score && current.boostSize === next.boostSize) {
        return prev;
      }
      return { ...prev, [tileType]: next };
    });
  }, []);

  return <TileActivityContext.Provider value={{ activity, report }}>{children}</TileActivityContext.Provider>;
}

/**
 * Called by a tile to report how active/urgent it currently is: `score` is
 * an arbitrary positive number (higher sorts earlier), `boostSize` asks the
 * grid to temporarily render this tile at "lg" regardless of its saved size.
 * A no-op outside a TileActivityProvider, so tiles stay safe to reuse
 * anywhere (e.g. a future preview context) without this hook throwing.
 */
export function useReportActivity(tileType: string, score: number, boostSize = false) {
  const ctx = useContext(TileActivityContext);
  useEffect(() => {
    ctx?.report(tileType, { score, boostSize });
  }, [ctx, tileType, score, boostSize]);
}

export function useTileActivitySnapshot(): ActivityMap {
  return useContext(TileActivityContext)?.activity ?? {};
}
