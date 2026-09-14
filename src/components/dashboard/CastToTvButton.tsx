"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useSnackbar } from "@/hooks/useSnackbar";

export function CastToTvButton() {
  const [busy, setBusy] = useState(false);
  const showSnackbar = useSnackbar();

  async function cast() {
    const nav = navigator as Navigator & {
      presentation?: Presentation;
    };
    const PresentationCtor = nav.presentation;

    if (!PresentationCtor) {
      showSnackbar("TV casting isn't supported by this browser.");
      return;
    }

    try {
      setBusy(true);
      const request = new PresentationRequest([window.location.origin + "/dashboard"]);
      const connection = await request.start();
      showSnackbar(connection ? "Connected to your TV." : "Choose a TV to continue.");
    } catch {
      // User cancellation is intentionally silent; browser errors get a small
      // actionable message without breaking the dashboard.
      showSnackbar("No TV was selected.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={cast}
      disabled={busy}
      className="glass-pill flex min-h-10 items-center gap-2 px-3 text-sm font-medium disabled:opacity-50"
      style={{ color: "var(--ink-soft)" }}
      aria-label="Cast dashboard to TV"
      title="Cast dashboard to TV"
    >
      <Icon name="cast" className="h-4 w-4" />
      <span className="hidden sm:inline">Cast</span>
    </button>
  );
}
