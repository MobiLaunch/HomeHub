"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { HubMark } from "@/components/HubMark";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import { CalendarDays, MessageSquare, Bell, StickyNote, Sparkles, Check } from "lucide-react";

const STEP_LABELS = ["Welcome", "Your home", "Connect accounts", "Choose tiles", "Done"];

const TILE_META: Record<string, { label: string; icon: typeof CalendarDays; hint: string }> = {
  calendar: { label: "Calendar", icon: CalendarDays, hint: "Upcoming events across every connected calendar" },
  messages: { label: "Messages", icon: MessageSquare, hint: "Recent Slack & Teams activity" },
  notifications: { label: "Live activity", icon: Bell, hint: "A flippable stack of new messages, upcoming events, and reminders" },
  notes: { label: "Notes", icon: StickyNote, hint: "Sticky notes anyone in the house can leave" },
  stickers: { label: "Stickers", icon: Sparkles, hint: "A playful corkboard for the family" },
};

function SetupWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Our Home");
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [tiles, setTiles] = useState<{ tileType: string; enabled: boolean }[] | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    // Jump back to the integrations step after the OAuth redirect returns
    // here with ?connected=... or ?error=... in the URL.
    if (searchParams.get("connected") || searchParams.get("error")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(2);
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/household")
      .then((r) => r.json())
      .then((json) => {
        if (json.household?.name) setName(json.household.name);
        if (json.household?.timezone) setTimezone(json.household.timezone);
      });
    fetch("/api/tiles")
      .then((r) => r.json())
      .then((json) => setTiles(json.tiles));
  }, []);

  async function saveHouseholdBasics() {
    await fetch("/api/household", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, timezone }),
    });
  }

  async function toggleTile(tileType: string) {
    setTiles((prev) =>
      prev
        ? prev.map((t) => (t.tileType === tileType ? { ...t, enabled: !t.enabled } : t))
        : prev,
    );
    const current = tiles?.find((t) => t.tileType === tileType);
    await fetch("/api/tiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tileType, enabled: !current?.enabled }),
    });
  }

  async function finish() {
    setFinishing(true);
    await fetch("/api/household", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, timezone, setupCompleted: true }),
    });
    router.push("/dashboard");
  }

  const next = async () => {
    if (step === 1) await saveHouseholdBasics();
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div className="flex items-center justify-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <motion.div
              animate={{
                background: i <= step ? "var(--accent)" : "var(--glass-fill)",
                color: i <= step ? "#ffffff" : "var(--ink-soft)",
                scale: i === step ? 1.15 : 1,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium"
              style={{ border: i <= step ? "none" : "1px solid var(--glass-border)" }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {i < step ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  >
                    <Check className="h-3 w-3" />
                  </motion.span>
                ) : (
                  <motion.span key="num" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {i + 1}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
            {i < STEP_LABELS.length - 1 && (
              <div className="relative h-px w-6 overflow-hidden" style={{ background: "var(--glass-border)" }}>
                <motion.div
                  className="absolute inset-y-0 left-0 h-full"
                  style={{ background: "var(--accent)" }}
                  animate={{ width: i < step ? "100%" : "0%" }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="glass-strong min-h-[420px] p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full flex-col"
          >
            {step === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
                <HubMark size={64} />
                <div>
                  <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                    Welcome to HomeHub
                  </h1>
                  <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: "var(--ink-soft)" }}>
                    One glanceable screen for your whole household — calendars, messages,
                    reminders, and notes, live. Let&apos;s get it set up.
                  </p>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-1 flex-col gap-5">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
                    A little about your home
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                    This appears in your dashboard&apos;s daily greeting.
                  </p>
                </div>
                <label className="flex flex-col gap-1.5 text-sm" style={{ color: "var(--ink-soft)" }}>
                  Household name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="glass-pill px-4 py-2.5 text-base outline-none"
                    style={{ color: "var(--ink)" }}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm" style={{ color: "var(--ink-soft)" }}>
                  Timezone
                  <input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="glass-pill px-4 py-2.5 text-base outline-none"
                    style={{ color: "var(--ink)" }}
                  />
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-1 flex-col gap-4">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
                    Connect your accounts
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                    Optional, and you can always add more later from Settings.
                  </p>
                </div>
                <div className="max-h-[280px] overflow-y-auto pr-1">
                  <IntegrationsPanel returnTo="setup" />
                </div>
              </div>
            )}

            {step === 3 && tiles && (
              <div className="flex flex-1 flex-col gap-4">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
                    Choose your tiles
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                    Show or hide these on your dashboard. You can rearrange later.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {tiles.map((tile) => {
                    const meta = TILE_META[tile.tileType];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    return (
                      <motion.button
                        key={tile.tileType}
                        onClick={() => toggleTile(tile.tileType)}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        animate={{
                          boxShadow: tile.enabled
                            ? "0 0 0 2px var(--accent)"
                            : "0 0 0 0px transparent",
                          opacity: tile.enabled ? 1 : 0.55,
                        }}
                        transition={{ duration: 0.2 }}
                        className="glass relative flex items-start gap-3 p-4 text-left"
                      >
                        <Icon className="mt-0.5 h-5 w-5" style={{ color: "var(--accent)" }} />
                        <span>
                          <span className="block font-medium" style={{ color: "var(--ink)" }}>
                            {meta.label}
                          </span>
                          <span className="block text-xs" style={{ color: "var(--ink-soft)" }}>
                            {meta.hint}
                          </span>
                        </span>
                        <AnimatePresence>
                          {tile.enabled && (
                            <motion.span
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 20 }}
                              className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full"
                              style={{ background: "var(--accent)" }}
                            >
                              <Check className="h-3 w-3 text-white" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
                <HubMark size={64} />
                <div>
                  <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                    All set, {name}
                  </h1>
                  <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: "var(--ink-soft)" }}>
                    Your dashboard is ready. You can fine-tune everything anytime from Settings.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={back}
          disabled={step === 0}
          className="glass-pill px-5 py-2.5 text-sm font-medium disabled:opacity-0"
          style={{ color: "var(--ink-soft)" }}
        >
          Back
        </button>
        {step < STEP_LABELS.length - 1 ? (
          <button
            onClick={next}
            className="glass-pill px-6 py-2.5 text-sm font-semibold"
            style={{ color: "var(--accent)" }}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={finishing}
            className="glass-pill px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ color: "var(--accent)" }}
          >
            {finishing ? "Opening dashboard…" : "Go to my dashboard"}
          </button>
        )}
      </div>
    </main>
  );
}

export default function SetupPage() {
  return (
    <Suspense>
      <SetupWizard />
    </Suspense>
  );
}
