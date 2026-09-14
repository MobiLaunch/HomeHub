"use client";

import { useState } from "react";
import { mutate } from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { useLive } from "@/hooks/useLive";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import { useRipple } from "@/hooks/useRipple";
import { useSnackbar } from "@/hooks/useSnackbar";
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

const INTEGRATIONS_URL = "/api/integrations";

const BRAND: Record<ProviderInfo["id"], { mark: string; className: string }> = {
  google: { mark: "G", className: "bg-white text-[#4285f4] shadow-sm" },
  microsoft: { mark: "M", className: "bg-white text-[#2563eb] shadow-sm" },
  slack: { mark: "#", className: "bg-white text-[#611f69] shadow-sm" },
  facebook: { mark: "f", className: "bg-[#1877f2] text-white" },
  apple: { mark: "", className: "bg-black text-white" },
  spotify: { mark: "●", className: "bg-[#1db954] text-white" },
};

export function IntegrationsPanel({ returnTo }: { returnTo: "setup" | "settings" }) {
  const { data, error, isLoading } = useLive<{ providers: ProviderInfo[] }>(INTEGRATIONS_URL, 60_000);
  const providers = data?.providers ?? null;
  const showSnackbar = useSnackbar();

  async function disconnect(providerId: string, accountId: string, label: string) {
    await fetch(`/api/integrations/${providerId}/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: accountId }),
    });
    mutate(INTEGRATIONS_URL);
    showSnackbar(`Disconnected ${label}`);
  }

  if (error) {
    return (
      <div className="glass flex flex-col items-start gap-2 p-4 text-sm" style={{ color: "var(--ink)" }}>
        <span className="flex items-center gap-2 font-medium">
          <Icon name="warning" className="h-4 w-4 text-rose-500" /> Couldn&apos;t load integrations
        </span>
        <span style={{ color: "var(--ink-soft)" }}>{error.message}</span>
        <button onClick={() => mutate(INTEGRATIONS_URL)} className="glass-pill mt-1 flex min-h-11 items-center gap-1.5 px-3 py-1.5 text-xs font-medium" style={{ color: "var(--accent)" }}>
          <Icon name="refresh" className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (isLoading || !providers) {
    return <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-soft)" }}><Icon name="progress_activity" className="h-4 w-4 animate-spin" /> Loading integrations…</div>;
  }

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
      {providers.map((provider, index) => (
        <div key={provider.id} className="w-[calc(100vw-2rem)] shrink-0 snap-center sm:w-auto sm:shrink">
          <ProviderCard provider={provider} index={index} returnTo={returnTo} onDisconnect={(accountId, label) => disconnect(provider.id, accountId, label)} />
        </div>
      ))}
    </div>
  );
}

function ProviderCard({ provider, index, returnTo, onDisconnect }: { provider: ProviderInfo; index: number; returnTo: "setup" | "settings"; onDisconnect: (accountId: string, label: string) => void }) {
  const brand = BRAND[provider.id];
  const { ref: glowRef, onPointerMove: glowMove, onPointerLeave: glowLeave } = usePointerGlow<HTMLDivElement>();
  const { onPointerDown: connectRippleDown, rippleLayer: connectRipple } = useRipple<HTMLAnchorElement>();
  const { onPointerDown: appleRippleDown, rippleLayer: appleRipple } = useRipple<HTMLButtonElement>();
  const [appleForm, setAppleForm] = useState({ appleId: "", appPassword: "" });
  const [appleBusy, setAppleBusy] = useState(false);
  const [appleError, setAppleError] = useState<string | null>(null);

  async function connectApple(e: React.FormEvent) {
    e.preventDefault();
    setAppleBusy(true);
    setAppleError(null);
    try {
      const res = await fetch("/api/integrations/apple/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(appleForm) });
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
    <motion.div ref={glowRef} onPointerMove={glowMove} onPointerLeave={glowLeave} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }} className="glass glow flex h-full flex-col gap-3 p-5">
      <div className="relative z-10 flex items-start gap-3">
        <motion.div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold ${brand.className}`} whileHover={{ rotate: 4, scale: 1.08 }} transition={{ type: "spring", stiffness: 350, damping: 14 }} aria-hidden="true">{brand.mark}</motion.div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium" style={{ color: "var(--ink)" }}>{provider.displayName}</p>
            {provider.accounts.length > 0 && <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Connected</span>}
          </div>
          <p className="text-xs leading-snug" style={{ color: "var(--ink-soft)" }}>{provider.description}</p>
        </div>
      </div>

      {provider.accounts.length > 0 && (
        <ul className="relative z-10 flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {provider.accounts.map((account) => <AccountRow key={account.id} account={account} onDisconnect={() => onDisconnect(account.id, account.label)} />)}
          </AnimatePresence>
        </ul>
      )}

      {provider.authType === "oauth" && (
        <motion.a
          href={provider.configured ? `/api/integrations/${provider.id}/connect?from=${returnTo}` : undefined}
          onPointerDown={connectRippleDown}
          whileTap={{ scale: 0.97 }}
          aria-disabled={!provider.configured}
          className="ripple-surface relative z-10 flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-transform aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
          style={{ color: "var(--ink)", borderColor: "var(--glass-border)", background: "var(--glass-fill-strong)" }}
          aria-label={provider.configured ? `Connect to ${provider.displayName}` : `${provider.displayName} is not enabled`}
        >
          {connectRipple}
          <BrandMark provider={provider.id} />
          {provider.configured ? (provider.accounts.length > 0 ? `Connect another ${provider.displayName}` : `Connect to ${provider.displayName}`) : "Not enabled by host"}
        </motion.a>
      )}

      {provider.authType === "credentials" && (
        <form onSubmit={connectApple} className="relative z-10 flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: "var(--glass-fill-strong)", color: "var(--ink-soft)" }}><BrandMark provider={provider.id} /><span>Apple requires an app-specific password for iCloud CalDAV access.</span></div>
          <input type="email" required placeholder="Apple ID" value={appleForm.appleId} onChange={(e) => setAppleForm((f) => ({ ...f, appleId: e.target.value }))} className="glass-pill px-3 py-2 text-sm outline-none transition-shadow focus:ring-2" style={{ color: "var(--ink)", "--tw-ring-color": "var(--accent-soft)" } as React.CSSProperties} />
          <input type="password" required placeholder="App-specific password" value={appleForm.appPassword} onChange={(e) => setAppleForm((f) => ({ ...f, appPassword: e.target.value }))} className="glass-pill px-3 py-2 text-sm outline-none transition-shadow focus:ring-2" style={{ color: "var(--ink)", "--tw-ring-color": "var(--accent-soft)" } as React.CSSProperties} />
          <p className="text-[11px] leading-snug" style={{ color: "var(--ink-soft)" }}>Your iCloud password itself is never stored.</p>
          {appleError && <p className="text-xs text-rose-500">{appleError}</p>}
          <motion.button type="submit" disabled={appleBusy} onPointerDown={appleRippleDown} whileTap={{ scale: 0.97 }} className="ripple-surface glass-pill flex min-h-11 items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium disabled:opacity-50" style={{ color: "var(--ink)" }}>
            {appleRipple}<BrandMark provider={provider.id} />{appleBusy ? "Connecting…" : "Connect Apple Calendar"}
          </motion.button>
        </form>
      )}
    </motion.div>
  );
}

function BrandMark({ provider }: { provider: ProviderInfo["id"] }) {
  const brand = BRAND[provider];
  return <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${brand.className}`} aria-hidden="true">{brand.mark}</span>;
}

function AccountRow({ account, onDisconnect }: { account: ProviderAccount; onDisconnect: () => void }) {
  const { onPointerDown, rippleLayer } = useRipple<HTMLButtonElement>();
  return (
    <motion.li initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="flex items-center justify-between gap-2 overflow-hidden rounded-xl px-3 py-2 text-sm" style={{ background: "var(--glass-fill-strong)" }}>
      <span className="flex min-w-0 items-center gap-2"><StatusDot status={account.status} /><span className="truncate" style={{ color: "var(--ink)" }}>{account.label}</span></span>
      <button onClick={onDisconnect} onPointerDown={onPointerDown} className="ripple-surface flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-xs opacity-70 transition-colors hover:text-rose-500 hover:opacity-100" style={{ color: "var(--ink-soft)" }}>{rippleLayer}<Icon name="link_off" className="h-3.5 w-3.5" />Disconnect</button>
    </motion.li>
  );
}

function StatusDot({ status }: { status: ProviderAccount["status"] }) {
  const color = status === "connected" ? "#34d399" : status === "needs_reauth" ? "#fbbf24" : status === "error" ? "#fb7185" : "#94a3b8";
  return <span className="relative flex h-2 w-2 shrink-0">{status === "connected" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />}<span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} /></span>;
}
