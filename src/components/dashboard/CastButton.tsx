"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

type PresentationNavigator = Navigator & {
  presentation?: {
    defaultRequest?: PresentationRequest;
  };
};

/**
 * Uses the browser Presentation API when available. This is intentionally
 * standards-based: compatible Chrome/Edge receivers can be discovered by the
 * browser, while unsupported browsers get a clear fallback.
 */
export function CastButton() {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "presentation" in navigator);
  }, []);

  async function cast() {
    setMessage(null);
    const nav = navigator as PresentationNavigator;

    if (!nav.presentation || typeof PresentationRequest === "undefined") {
      setMessage("Casting is not supported by this browser. Try Chrome or Edge on a compatible TV.");
      return;
    }

    setBusy(true);
    try {
      const request = new PresentationRequest([window.location.href]);
      nav.presentation.defaultRequest = request;
      await request.start();
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name !== "NotAllowedError" && name !== "AbortError") {
        setMessage("No compatible TV was selected. Make sure the TV is on the same network.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={cast}
        disabled={busy}
        className="glass-pill flex min-h-11 items-center gap-2 px-3.5 py-2 text-sm font-medium transition-transform active:scale-[0.97] disabled:opacity-60"
        style={{ color: "var(--ink)" }}
        aria-label="Cast HomeHub to a TV"
        title="Cast HomeHub to a TV"
      >
        <Icon name="cast" className="h-5 w-5" />
        <span className="hidden sm:inline">{busy ? "Connecting…" : "Cast to TV"}</span>
      </button>
      {message && (
        <p
          role="status"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl p-3 text-xs shadow-xl"
          style={{ background: "var(--glass-fill-strong)", color: "var(--ink-soft)", border: "1px solid var(--glass-border)" }}
        >
          {message}
        </p>
      )}
      {!supported && !message && (
        <span className="sr-only">TV casting may be unavailable in this browser.</span>
      )}
    </div>
  );
}
