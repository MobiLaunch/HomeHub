"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, MessageSquare, Bell, StickyNote, Sparkles } from "lucide-react";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import { ThemeToggle } from "@/components/ThemeToggle";

type TilePref = { tileType: string; enabled: boolean };

const TILE_META: Record<string, { label: string; icon: typeof CalendarDays }> = {
  calendar: { label: "Calendar", icon: CalendarDays },
  messages: { label: "Messages", icon: MessageSquare },
  notifications: { label: "Live activity", icon: Bell },
  notes: { label: "Notes", icon: StickyNote },
  stickers: { label: "Stickers", icon: Sparkles },
};

function SettingsBanner() {
  const searchParams = useSearchParams();
  const connected = searchParams.get("connected");
  const error = searchParams.get("error");
  if (!connected && !error) return null;
  return (
    <div
      className="glass px-4 py-3 text-sm"
      style={{ color: connected ? "#059669" : "#e11d48" }}
    >
      {connected ? `Connected ${connected} successfully.` : `Couldn't connect: ${error}`}
    </div>
  );
}

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [tiles, setTiles] = useState<TilePref[] | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/household")
      .then((r) => r.json())
      .then((json) => {
        setName(json.household?.name ?? "");
        setTimezone(json.household?.timezone ?? "");
      });
    fetch("/api/tiles")
      .then((r) => r.json())
      .then((json) => setTiles(json.tiles));
  }, []);

  async function saveHousehold() {
    await fetch("/api/household", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, timezone }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function toggleTile(tileType: string) {
    setTiles((prev) =>
      prev ? prev.map((t) => (t.tileType === tileType ? { ...t, enabled: !t.enabled } : t)) : prev,
    );
    const current = tiles?.find((t) => t.tileType === tileType);
    await fetch("/api/tiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tileType, enabled: !current?.enabled }),
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="glass-pill flex h-9 w-9 items-center justify-center"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
        </Link>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          Settings
        </h1>
      </div>

      <Suspense>
        <SettingsBanner />
      </Suspense>

      <section className="glass flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Household
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1.5 text-sm" style={{ color: "var(--ink-soft)" }}>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveHousehold}
              className="glass-pill px-4 py-2 text-sm outline-none"
              style={{ color: "var(--ink)" }}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm" style={{ color: "var(--ink-soft)" }}>
            Timezone
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              onBlur={saveHousehold}
              className="glass-pill px-4 py-2 text-sm outline-none"
              style={{ color: "var(--ink)" }}
            />
          </label>
        </div>
        {saved && <p className="text-xs text-emerald-500">Saved</p>}
        <div>
          <p className="mb-1.5 text-xs" style={{ color: "var(--ink-soft)" }}>
            Appearance
          </p>
          <ThemeToggle />
        </div>
      </section>

      <section className="glass flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Dashboard tiles
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(tiles ?? []).map((tile) => {
            const meta = TILE_META[tile.tileType];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <button
                key={tile.tileType}
                onClick={() => toggleTile(tile.tileType)}
                className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm transition"
                style={{
                  background: "var(--glass-fill-strong)",
                  opacity: tile.enabled ? 1 : 0.5,
                  color: "var(--ink)",
                }}
              >
                <Icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Connected accounts
        </h2>
        <IntegrationsPanel returnTo="settings" />
      </section>
    </main>
  );
}
