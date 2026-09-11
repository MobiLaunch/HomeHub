"use client";

import { useState } from "react";
import { mutate } from "swr";
import { useLive } from "@/hooks/useLive";
import {
  CalendarDays,
  Building2,
  Hash,
  Cake,
  Apple,
  Link as LinkIcon,
  Unlink,
  LoaderCircle as LoaderIcon,
  TriangleAlert,
  RefreshCw,
} from "lucide-react";

type ProviderAccount = {
  id: string;
  label: string;
  status: "connected" | "needs_reauth" | "error" | "disconnected";
  lastSyncedAt: string | null;
  lastError: string | null;
};

type ProviderInfo = {
  id: "google" | "microsoft" | "slack" | "facebook" | "apple";
  displayName: string;
  description: string;
  authType: "oauth" | "credentials";
  configured: boolean;
  accounts: ProviderAccount[];
};

const ICONS: Record<ProviderInfo["id"], typeof CalendarDays> = {
  google: CalendarDays,
  microsoft: Building2,
  slack: Hash,
  facebook: Cake,
  apple: Apple,
};

const INTEGRATIONS_URL = "/api/integrations";

export function IntegrationsPanel({ returnTo }: { returnTo: "setup" | "settings" }) {
  const { data, error, isLoading } = useLive<{ providers: ProviderInfo[] }>(INTEGRATIONS_URL, 60_000);
  const providers = data?.providers ?? null;
  const [appleForm, setAppleForm] = useState<{ appleId: string; appPassword: string }>({
    appleId: "",
    appPassword: "",
  });
  const [appleBusy, setAppleBusy] = useState(false);
  const [appleError, setAppleError] = useState<string | null>(null);

  async function disconnect(providerId: string, accountId: string) {
    await fetch(`/api/integrations/${providerId}/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: accountId }),
    });
    mutate(INTEGRATIONS_URL);
  }

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

  if (error) {
    return (
      <div className="glass flex flex-col items-start gap-2 p-4 text-sm" style={{ color: "var(--ink)" }}>
        <span className="flex items-center gap-2 font-medium">
          <TriangleAlert className="h-4 w-4 text-rose-500" /> Couldn&apos;t load integrations
        </span>
        <span style={{ color: "var(--ink-soft)" }}>{error.message}</span>
        <button
          onClick={() => mutate(INTEGRATIONS_URL)}
          className="glass-pill mt-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          style={{ color: "var(--accent)" }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (isLoading || !providers) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-soft)" }}>
        <LoaderIcon className="h-4 w-4 animate-spin" /> Loading integrations…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {providers.map((provider) => {
        const Icon = ICONS[provider.id];
        return (
          <div key={provider.id} className="glass flex flex-col gap-3 p-5">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <Icon className="h-5 w-5" />
              </div>
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
              <ul className="flex flex-col gap-1.5">
                {provider.accounts.map((account) => (
                  <li
                    key={account.id}
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm"
                    style={{ background: "var(--glass-fill-strong)" }}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <StatusDot status={account.status} />
                      <span className="truncate" style={{ color: "var(--ink)" }}>
                        {account.label}
                      </span>
                    </span>
                    <button
                      onClick={() => disconnect(provider.id, account.id)}
                      className="flex shrink-0 items-center gap-1 text-xs opacity-70 hover:opacity-100"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      Disconnect
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!provider.configured && provider.authType === "oauth" && (
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                Not yet configured — add the {provider.id.toUpperCase()}_CLIENT_ID /
                _CLIENT_SECRET to your environment to enable this connection.
              </p>
            )}

            {provider.authType === "oauth" && provider.configured && (
              <a
                href={`/api/integrations/${provider.id}/connect?from=${returnTo}`}
                className="glass-pill flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition hover:opacity-90"
                style={{ color: "var(--accent)" }}
              >
                <LinkIcon className="h-4 w-4" />
                Connect {provider.displayName}
              </a>
            )}

            {provider.authType === "credentials" && (
              <form onSubmit={connectApple} className="flex flex-col gap-2">
                <input
                  type="email"
                  required
                  placeholder="Apple ID"
                  value={appleForm.appleId}
                  onChange={(e) => setAppleForm((f) => ({ ...f, appleId: e.target.value }))}
                  className="glass-pill px-3 py-2 text-sm outline-none"
                  style={{ color: "var(--ink)" }}
                />
                <input
                  type="password"
                  required
                  placeholder="App-specific password"
                  value={appleForm.appPassword}
                  onChange={(e) => setAppleForm((f) => ({ ...f, appPassword: e.target.value }))}
                  className="glass-pill px-3 py-2 text-sm outline-none"
                  style={{ color: "var(--ink)" }}
                />
                <p className="text-[11px] leading-snug" style={{ color: "var(--ink-soft)" }}>
                  Generate one at appleid.apple.com → Sign-In and Security → App-Specific
                  Passwords. Your iCloud password itself is never stored.
                </p>
                {appleError && <p className="text-xs text-rose-500">{appleError}</p>}
                <button
                  type="submit"
                  disabled={appleBusy}
                  className="glass-pill flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
                  style={{ color: "var(--accent)" }}
                >
                  {appleBusy ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                  Connect Apple Calendar
                </button>
              </form>
            )}
          </div>
        );
      })}
    </div>
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
  return <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />;
}
