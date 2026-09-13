"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/Icon";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Switch } from "@/components/Switch";
import { usePointerGlow } from "@/hooks/usePointerGlow";

type TilePref = { tileType: string; enabled: boolean };

const TILE_META: Record<string, { label: string; icon: string }> = {
  calendar: { label: "Calendar", icon: "calendar_month" },
  messages: { label: "Messages", icon: "forum" },
  notifications: { label: "Live activity", icon: "notifications" },
  notes: { label: "Notes", icon: "sticky_note_2" },
  stickers: { label: "Stickers", icon: "auto_awesome" },
  facebook_insights: { label: "Page insights", icon: "thumb_up" },
  spotify: { label: "Now playing", icon: "graphic_eq" },
};

function SettingsBanner() {
  const searchParams = useSearchParams();
  const connected = searchParams.get("connected");
  const error = searchParams.get("error");
  if (!connected && !error) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass px-4 py-3 text-sm"
      style={{ color: connected ? "#059669" : "#e11d48" }}
    >
      {connected ? `Connected ${connected} successfully.` : `Couldn't connect: ${error}`}
    </motion.div>
  );
}

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [tiles, setTiles] = useState<TilePref[] | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    ref: householdGlowRef,
    onPointerMove: householdGlowMove,
    onPointerLeave: householdGlowLeave,
  } = usePointerGlow<HTMLElement>();
  const {
    ref: tilesGlowRef,
    onPointerMove: tilesGlowMove,
    onPointerLeave: tilesGlowLeave,
  } = usePointerGlow<HTMLElement>();

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
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8"
    >
      <div className="flex items-center gap-3">
        <Link href="/dashboard" aria-label="Back to dashboard">
          <motion.span
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.9 }}
            className="glass-pill flex h-9 w-9 items-center justify-center"
          >
            <Icon name="arrow_back" className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
          </motion.span>
        </Link>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          Settings
        </h1>
      </div>

      <Suspense>
        <SettingsBanner />
      </Suspense>

      <section
        ref={householdGlowRef}
        onPointerMove={householdGlowMove}
        onPointerLeave={householdGlowLeave}
        className="glass glow flex flex-col gap-4 p-5"
      >
        <h2 className="relative z-10 text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Household
        </h2>
        <div className="relative z-10 flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1.5 text-sm" style={{ color: "var(--ink-soft)" }}>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveHousehold}
              className="glass-pill px-4 py-2 text-sm outline-none transition-shadow focus:ring-2"
              style={{ color: "var(--ink)", "--tw-ring-color": "var(--accent-soft)" } as React.CSSProperties}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm" style={{ color: "var(--ink-soft)" }}>
            Timezone
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              onBlur={saveHousehold}
              className="glass-pill px-4 py-2 text-sm outline-none transition-shadow focus:ring-2"
              style={{ color: "var(--ink)", "--tw-ring-color": "var(--accent-soft)" } as React.CSSProperties}
            />
          </label>
        </div>
        <div className="relative z-10 h-4">
          <AnimatePresence>
            {saved && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1 text-xs text-emerald-500"
              >
                <Icon name="check" className="h-3 w-3" /> Saved
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="relative z-10">
          <p className="mb-1.5 text-xs" style={{ color: "var(--ink-soft)" }}>
            Appearance
          </p>
          <ThemeToggle />
        </div>
      </section>

      <section
        ref={tilesGlowRef}
        onPointerMove={tilesGlowMove}
        onPointerLeave={tilesGlowLeave}
        className="glass glow flex flex-col gap-4 p-5"
      >
        <h2 className="relative z-10 text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Dashboard tiles
        </h2>
        <div className="relative z-10 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(tiles ?? []).map((tile) => {
            const meta = TILE_META[tile.tileType];
            if (!meta) return null;
            return (
              <motion.div
                key={tile.tileType}
                animate={{ opacity: tile.enabled ? 1 : 0.6 }}
                className="flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-sm"
                style={{ background: "var(--glass-fill-strong)", color: "var(--ink)" }}
              >
                <span className="flex items-center gap-2">
                  <motion.span
                    animate={{ rotate: tile.enabled ? 0 : -20, scale: tile.enabled ? 1 : 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 16 }}
                  >
                    <Icon name={meta.icon} className="h-4 w-4" style={{ color: "var(--accent)" }} />
                  </motion.span>
                  {meta.label}
                </span>
                <Switch
                  checked={tile.enabled}
                  onChange={() => toggleTile(tile.tileType)}
                  label={`Show ${meta.label} on dashboard`}
                />
              </motion.div>
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
    </motion.main>
  );
}
