"use client";

import { mutate } from "swr";
import { Icon } from "@/components/Icon";
import { Switch } from "@/components/Switch";
import { useLive } from "@/hooks/useLive";
import { useReportActivity } from "@/hooks/useTileActivity";
import { useSnackbar } from "@/hooks/useSnackbar";
import { useRipple } from "@/hooks/useRipple";
import type { BridgeDevice } from "@/app/api/live/home-status/route";

const HOME_STATUS_URL = "/api/live/home-status";
const TEMP_STEP = 1;

async function sendCommand(deviceId: string, command: Record<string, unknown>) {
  const res = await fetch(HOME_STATUS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, command }),
  });
  if (!res.ok) throw new Error("Command failed");
}

/** `expanded` is set inside the full-surface tile overlay — Home Status
 * just gets a little more breathing room there, not a different layout. */
export function HomeStatusTile({ expanded = false }: { expanded?: boolean }) {
  const { data, isLoading } = useLive<{ devices: BridgeDevice[] }>(HOME_STATUS_URL, 15_000);
  const devices = data?.devices ?? [];
  const showSnackbar = useSnackbar();

  const unlockedCount = devices.filter((d) => d.kind === "lock" && d.locked === false).length;
  useReportActivity("home_status", unlockedCount > 0 ? 90 : 0, unlockedCount > 0);

  async function optimisticUpdate(deviceId: string, patch: Partial<BridgeDevice>, command: Record<string, unknown>) {
    mutate(
      HOME_STATUS_URL,
      (current: { devices: BridgeDevice[] } | undefined) =>
        current && { devices: current.devices.map((d) => (d.id === deviceId ? { ...d, ...patch } : d)) },
      { revalidate: false },
    );
    try {
      await sendCommand(deviceId, command);
    }
    catch {
      showSnackbar("Couldn't reach the bridge — check it's still running");
    }
    mutate(HOME_STATUS_URL);
  }

  if (isLoading && devices.length === 0) {
    return <EmptyState text="Checking your devices…" />;
  }
  if (devices.length === 0) {
    return <EmptyState text="Connect Home Status in Settings to control lights, locks, and climate." />;
  }

  const climate = devices.filter((d): d is BridgeDevice & { kind: "climate" } => d.kind === "climate");
  const locks = devices.filter((d): d is BridgeDevice & { kind: "lock" } => d.kind === "lock");
  const lights = devices.filter((d): d is BridgeDevice & { kind: "light" } => d.kind === "light");

  return (
    <div className={`flex flex-col gap-4 ${expanded ? "gap-5" : ""}`}>
      {climate.length > 0 && (
        <Section title="Climate">
          {climate.map((device) => (
            <ClimateRow
              key={device.id}
              device={device}
              large={expanded}
              onChange={(targetTemp) => optimisticUpdate(device.id, { targetTemp }, { targetTemp })}
            />
          ))}
        </Section>
      )}
      {locks.length > 0 && (
        <Section title="Locks">
          {locks.map((device) => (
            <LockRow
              key={device.id}
              device={device}
              large={expanded}
              onToggle={() => optimisticUpdate(device.id, { locked: !device.locked }, { locked: !device.locked })}
            />
          ))}
        </Section>
      )}
      {lights.length > 0 && (
        <Section title="Lights">
          {lights.map((device) => (
            <LightRow
              key={device.id}
              device={device}
              large={expanded}
              onToggle={(on) => optimisticUpdate(device.id, { on }, { on })}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>{title}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function DeviceRow({ icon, iconColor, name, error, large, children }: {
  icon: string;
  iconColor: string;
  name: string;
  error?: string;
  large?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-3.5 ${large ? "py-3.5" : "py-2.5"}`} style={{ background: "var(--glass-fill-strong)" }}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--accent-soft)" }}>
        <Icon name={icon} className="h-4.5 w-4.5" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>{name}</p>
        {error && (
          <p className="flex items-center gap-1 truncate text-[11px]" style={{ color: "var(--m3-error)" }}>
            <Icon name="error" className="h-3 w-3" /> Unreachable
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function LightRow({ device, large, onToggle }: { device: BridgeDevice; large?: boolean; onToggle: (on: boolean) => void }) {
  return (
    <DeviceRow icon="lightbulb" iconColor="var(--accent)" name={device.name} error={device.error} large={large}>
      <Switch checked={Boolean(device.on)} onChange={onToggle} label={`${device.name} power`} />
    </DeviceRow>
  );
}

function LockRow({ device, large, onToggle }: { device: BridgeDevice; large?: boolean; onToggle: () => void }) {
  const { onPointerDown, rippleLayer } = useRipple<HTMLButtonElement>();
  const locked = Boolean(device.locked);
  return (
    <DeviceRow icon={locked ? "lock" : "lock_open"} iconColor={locked ? "var(--accent)" : "#f59e0b"} name={device.name} error={device.error} large={large}>
      <button
        onClick={onToggle}
        onPointerDown={onPointerDown}
        className="ripple-surface relative flex min-h-9 shrink-0 items-center gap-1.5 overflow-hidden rounded-full px-3.5 py-1.5 text-xs font-semibold"
        style={{ background: locked ? "var(--accent-soft)" : "rgba(245, 158, 11, 0.16)", color: locked ? "var(--accent)" : "#b45309" }}
        aria-label={`${locked ? "Unlock" : "Lock"} ${device.name}`}
      >
        {rippleLayer}
        {locked ? "Locked" : "Unlocked"}
      </button>
    </DeviceRow>
  );
}

function ClimateRow({ device, large, onChange }: { device: BridgeDevice; large?: boolean; onChange: (targetTemp: number) => void }) {
  const { onPointerDown: downDown, rippleLayer: downRipple } = useRipple<HTMLButtonElement>();
  const { onPointerDown: upDown, rippleLayer: upRipple } = useRipple<HTMLButtonElement>();
  const target = device.targetTemp ?? device.currentTemp ?? 70;

  return (
    <DeviceRow icon="thermostat" iconColor="var(--accent)" name={device.name} error={device.error} large={large}>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
        {typeof device.currentTemp === "number" && (
          <span className="mr-2 shrink-0 text-xs" style={{ color: "var(--ink-soft)" }}>{Math.round(device.currentTemp)}°now</span>
        )}
        <button onClick={() => onChange(target - TEMP_STEP)} onPointerDown={downDown} className="ripple-surface relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ background: "var(--surface-pill)" }} aria-label={`Lower ${device.name} target temperature`}>
          {downRipple}<Icon name="remove" className="h-4 w-4" style={{ color: "var(--ink)" }} />
        </button>
        <span className={`shrink-0 text-center font-semibold tabular-nums ${large ? "w-14 text-lg" : "w-11 text-sm"}`} style={{ color: "var(--ink)" }}>{Math.round(target)}°</span>
        <button onClick={() => onChange(target + TEMP_STEP)} onPointerDown={upDown} className="ripple-surface relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ background: "var(--surface-pill)" }} aria-label={`Raise ${device.name} target temperature`}>
          {upRipple}<Icon name="add" className="h-4 w-4" style={{ color: "var(--ink)" }} />
        </button>
      </div>
    </DeviceRow>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
      <Icon name="home" className="h-5 w-5" style={{ color: "var(--ink-soft)" }} />
      <p className="max-w-[220px] text-xs" style={{ color: "var(--ink-soft)" }}>{text}</p>
    </div>
  );
}
