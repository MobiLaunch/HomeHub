"use client";

import { useState } from "react";
import { mutate } from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { useLive } from "@/hooks/useLive";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import { Icon } from "@/components/Icon";

type ProviderAccount = {
  id: string;
  label: string;
  status: "connected" | "needs_reauth" | "error" | "disconnected";
  lastSyncedAt: string | null;
  lastError: string | null;
};

type ProviderInfo = {
  id: "google" | "microsoft" | "slack" | "facebook" | "apple" | "spotify";
  displayName: string;
  description: string;
  authType: "oauth" | "credentials";
  configured: boolean;
  accounts: ProviderAccount[];
};

const ICONS: Record<ProviderInfo["id"], string> = {
  google: "calendar_month",
  microsoft: "domain",
  slack: "tag",
  facebook: "thumb_up",
  apple: "calendar_today",
  spotify: "graphic_eq",
};

const INTEGRATIONS_URL = "/api/integrations";

export function IntegrationsPanel({ returnTo }: { returnTo: "setup" | "settings" }) {
  const { data, error, isLoading } = useLive<{ providers: ProviderInfo[] }>(INTEGRATIONS_URL, 60_000);
  const providers = data?.providers ?? null;

  async function disconnect(providerId: string, accountId: string) {
    await fetch(`/api/integrations/${providerId}/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: accountId }),
    });
    mutate(INTEGRATIONS_URL);
  }

  if (error) {
    return (
      <div className="glass flex flex-col items-start gap-2 p-4 text-sm" style={{ color: "var(--ink)" }}>
        <span className="flex items-center gap-2 font-medium">
          <Icon name="warning" className="h-4 w-4 text-rose-500" /> Couldn&apos;t load integrations
        </span>
        <span style={{ color: "var(--ink-soft)" }}>{error.message}</span>
        <button
          onClick={() => mutate(INTEGRATIONS_URL)}
          className="glass-pill mt-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          style={{ color: "var(--accent)" }}
        >
          <Icon name="refresh" className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (isLoading || !providers) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-soft)" }}>
        <Icon name="progress_activity" className="h-4 w-4 animate-spin" /> Loading integrations…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {providers.map((provider, index) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          index={index}
          returnTo={returnTo}
          onDisconnect={(accountId) => disconnect(provider.id, accountId)}
        />
      ))}
    </div>
  );
}

function ProviderCard({
  provider,
  index,
  returnTo,
  onDisconnect,
}: {
  provider: ProviderInfo;
  index: number;
  returnTo: "setup" | "settings";
  onDisconnect: (accountId: string) => void;
}) {
  const providerIcon = ICONS[provider.id];
  const { ref: glowRef, onPointerMove: glowMove, onPointerLeave: glowLeave } = usePointerGlow<HTMLDivElement>();
  const [appleForm, setAppleForm] = useState({ appleId: "", appPassword: "" });
  const [appleBusy, setAppleBusy] = useState(false);
  const [appleError, setAppleError] = useState<string | null>(null);

  async function connectApple(e: React.FormEvent) {
    e.preventDefault();
    setAppleBusy(true);
    setAppleError(null);
    try {
      const res = await fetch("/api/integrations/apple/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appleForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not connect");
      setAppleForm({ appleId: "", appPassword: "" });
      mutate(INTEGRATIONS_URL);
    } catch (err) {
      setAppleError((err as Error).message);
    } finally {
      setAppleBusy(false);
    }
  }

  return (
    <motion.div
      ref={glowRef}
      onPointerMove={glowMove}
      onPointerLeave={glowLeave}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="glass glow flex flex-col gap-3 p-5"
    >
      <div className="relative z-10 flex items-start gap-3">
        <motion.div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          whileHover={{ rotate: 6, scale: 1.08 }}
          transition={{ type: "spring", stiffness: 350, damping: 14 }}
        >
          <Icon name={providerIcon} className="h-5 w-5" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <p className="font-medium" style={{ color: "var(--ink)" }}>
            {provider.displayName}
          </p>
          <p className="text-xs leading-snug" style={{ color: "var(--ink-soft)" }}>
            {provider.description}
          </p>
        </div>
      </div>

      {provider.accounts.length > 0 && (
        <ul className="relative z-10 flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {provider.accounts.map((account) => (
              <motion.li
                key={account.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center justify-between gap-2 overflow-hidden rounded-xl px-3 py-2 text-sm"
                style={{ background: "var(--glass-fill-strong)" }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <StatusDot status={account.status} />
                  <span className="truncate" style={{ color: "var(--ink)" }}>
                    {account.label}
                  </span>
                </span>
                <button
                  onClick={() => onDisconnect(account.id)}
                  className="flex shrink-0 items-center gap-1 text-xs opacity-70 transition-colors hover:text-rose-500 hover:opacity-100"
                  style={{ color: "var(--ink-soft)" }}
                >
                  <Icon name="link_off" className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {!provider.configured && provider.authType === "oauth" && (
        <p className="relative z-10 text-xs" style={{ color: "var(--ink-soft)" }}>
          Not yet configured — add the {provider.id.toUpperCase()}_CLIENT_ID /
          _CLIENT_SECRET to your environment to enable this connection.
        </p>
      )}

      {provider.authType === "oauth" && provider.configured && (
        <motion.a
          href={`/api/integrations/${provider.id}/connect?from=${returnTo}`}
          whileTap={{ scale: 0.96 }}
          className="glass-pill relative z-10 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
          style={{ color: "var(--accent)" }}
        >
          <Icon name="link" className="h-4 w-4" />
          Connect {provider.displayName}
        </motion.a>
      )}

      {provider.authType === "credentials" && (
        <form onSubmit={connectApple} className="relative z-10 flex flex-col gap-2">
          <input
            type="email"
            required
            placeholder="Apple ID"
            value={appleForm.appleId}
            onChange={(e) => setAppleForm((f) => ({ ...f, appleId: e.target.value }))}
            className="glass-pill px-3 py-2 text-sm outline-none transition-shadow focus:ring-2"
            style={{ color: "var(--ink)", "--tw-ring-color": "var(--accent-soft)" } as React.CSSProperties}
          />
          <input
            type="password"
            required
            placeholder="App-specific password"
            value={appleForm.appPassword}
            onChange={(e) => setAppleForm((f) => ({ ...f, appPassword: e.target.value }))}
            className="glass-pill px-3 py-2 text-sm outline-none transition-shadow focus:ring-2"
            style={{ color: "var(--ink)", "--tw-ring-color": "var(--accent-soft)" } as React.CSSProperties}
          />
          <p className="text-[11px] leading-snug" style={{ color: "var(--ink-soft)" }}>
            Generate one at appleid.apple.com → Sign-In and Security → App-Specific
            Passwords. Your iCloud password itself is never stored.
          </p>
          {appleError && <p className="text-xs text-rose-500">{appleError}</p>}
          <motion.button
            type="submit"
            disabled={appleBusy}
            whileTap={{ scale: 0.96 }}
            className="glass-pill flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ color: "var(--accent)" }}
          >
            {appleBusy ? <Icon name="progress_activity" className="h-4 w-4 animate-spin" /> : <Icon name="link" className="h-4 w-4" />}
            Connect Apple Calendar
          </motion.button>
        </form>
      )}
    </motion.div>
  );
}

function StatusDot({ status }: { status: ProviderAccount["status"] }) {
  const color =
    status === "connected"
      ? "#34d399"
      : status === "needs_reauth"
        ? "#fbbf24"
        : status === "error"
          ? "#fb7185"
          : "#94a3b8";
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {status === "connected" && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ background: color }}
        />
      )}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}
