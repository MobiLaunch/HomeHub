"use client";

import { useEffect, useState } from "react";

const cache = new Map<string, string | null>();
const SAMPLE_SIZE = 16;

/**
 * Downsamples an image to a tiny canvas and averages its pixels into an
 * "r, g, b" string — a cheap stand-in for "dominant color" that's good
 * enough for a soft background glow. Cross-origin images that don't grant
 * canvas read access (or simply fail to load) resolve to null rather than
 * throwing, since this only ever feeds a decorative, optional tint.
 */
export function useAverageColor(url: string | null): string | null {
  const [lastUrl, setLastUrl] = useState(url);
  const [color, setColor] = useState<string | null>(url ? (cache.get(url) ?? null) : null);

  // Resolve synchronously (null, or an already-cached color) the moment the
  // url changes, during render rather than in an effect — the pattern React
  // itself recommends for "adjust state when a prop changes" instead of an
  // effect that would cause an extra cascading render.
  if (url !== lastUrl) {
    setLastUrl(url);
    setColor(url ? (cache.get(url) ?? null) : null);
  }

  useEffect(() => {
    if (!url || cache.has(url)) return;

    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("2d context unavailable");
        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          // Skip only near-fully-transparent pixels (antialiased edges) —
          // most album art has no alpha channel at all (opaque JPEG), but a
          // strict "fully opaque" threshold would wrongly exclude any pixel
          // with even mild transparency.
          if (data[i + 3] < 10) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        const rgb = count > 0 ? `${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}` : null;
        cache.set(url, rgb);
        if (!cancelled) setColor(rgb);
      } catch {
        cache.set(url, null);
        if (!cancelled) setColor(null);
      }
    };
    img.onerror = () => {
      cache.set(url, null);
      if (!cancelled) setColor(null);
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  return color;
}
