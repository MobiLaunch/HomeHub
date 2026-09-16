"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const AmbientColorContext = createContext<{
  rgb: string | null;
  report: (rgb: string | null) => void;
} | null>(null);

/**
 * Lets a widget hand the app's ambient background an "rgb, rgb, rgb" tint
 * derived from whatever it's currently showing (album art, for now), the
 * same reporter/snapshot shape as useTileActivity. A no-op outside the
 * provider so widgets stay safe to reuse anywhere.
 */
export function AmbientColorProvider({ children }: { children: ReactNode }) {
  const [rgb, setRgb] = useState<string | null>(null);
  return <AmbientColorContext.Provider value={{ rgb, report: setRgb }}>{children}</AmbientColorContext.Provider>;
}

export function useReportAmbientColor(rgb: string | null) {
  const ctx = useContext(AmbientColorContext);
  useEffect(() => {
    ctx?.report(rgb);
  }, [ctx, rgb]);
  useEffect(() => {
    return () => ctx?.report(null);
  }, [ctx]);
}

export function useAmbientColor(): string | null {
  return useContext(AmbientColorContext)?.rgb ?? null;
}
