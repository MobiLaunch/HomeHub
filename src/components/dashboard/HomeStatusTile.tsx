"use client";

import { mutate } from "swr";
import { CircularDial } from "@/components/CircularDial";
import { Icon } from "@/components/Icon";
import { PhotoIconTile } from "@/components/PhotoIconTile";
import { Switch } from "@/components/Switch";
import { useLive } from "@/hooks/useLive";
import { useReportActivity } from "@/hooks/useTileActivity";
import { useSnackbar } from "@/hooks/useSnackbar";
import { useRipple } from "@/hooks/useRipple";
import type { BridgeDevice } from "@/app/api/live/home-status/route";

const HOME_STATUS_URL = "/api/live/home-status";
const CLIMATE_MIN = 60;
const CLIMATE_MAX = 85;

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

  // Rooms are optional (set per-device in the plugin's config.json). Only
  // switch to room-grouped sections once at least one device actually has
  // one set — otherwise every existing setup keeps today's Climate/Locks/
  // Lights grouping with zero behavior change.
  const roomsInUse = Array.from(new Set(devices.map((d) => d.room).filter((r): r is string => Boolean(r))));

  return (
    <div className={`flex flex-col gap-4 ${expanded ? "gap-5" : ""}`}>
      {roomsInUse.length > 0
        ? [...roomsInUse, "Other"].map((room) => {
            const roomDevices = devices.filter((d) => (d.room ?? "Other") === room).sort(byKindOrder);
            if (roomDevices.length === 0) return null;
            return (
              <Section key={room} title={room}>
                {roomDevices.map((device) => (
                  <DeviceRowByKind key={device.id} device={device} large={expanded} onUpdate={optimisticUpdate} />
                ))}
              </Section>
            );
          })
        : (["climate", "lock", "light"] as const).map((kind) => {
            const kindDevices = devices.filter((d) => d.kind === kind);
            if (kindDevices.length === 0) return null;
            return (
              <Section key={kind} title={KIND_TITLE[kind]}>
                {kindDevices.map((device) => (
                  <DeviceRowByKind key={device.id} device={device} large={expanded} onUpdate={optimisticUpdate} />
                ))}
              </Section>
            );
          })}
    </div>
  );
}

const KIND_TITLE: Record<BridgeDevice["kind"], string> = { climate: "Climate", lock: "Locks", light: "Lights" };
const KIND_ORDER: Record<BridgeDevice["kind"], number> = { climate: 0, lock: 1, light: 2 };
function byKindOrder(a: BridgeDevice, b: BridgeDevice) {
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
}

function DeviceRowByKind({ device, large, onUpdate }: {
  device: BridgeDevice;
  large?: boolean;
  onUpdate: (deviceId: string, patch: Partial<BridgeDevice>, command: Record<string, unknown>) => void;
}) {
  if (device.kind === "light") {
    return <LightRow device={device} large={large} onToggle={(on) => onUpdate(device.id, { on }, { on })} />;
  }
  if (device.kind === "lock") {
    return <LockRow device={device} large={large} onToggle={() => onUpdate(device.id, { locked: !device.locked }, { locked: !device.locked })} />;
  }
  return <ClimateRow device={device} large={large} onChange={(targetTemp) => onUpdate(device.id, { targetTemp }, { targetTemp })} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>{title}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function DeviceRow({ icon, iconColor, name, error, large, active, photoUrl, children }: {
  icon: string;
  iconColor: string;
  name: string;
  error?: string;
  large?: boolean;
  /** Shows a soft concentric ring behind the icon — the kit's "this is live" cue, kept static rather than animated so a dashboard full of devices doesn't turn into a wall of pulsing rings. */
  active?: boolean;
  photoUrl?: string;
  children: React.ReactNode;
}) {
  const iconSize = large ? 44 : 36;
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-3.5 ${large ? "py-3.5" : "py-2.5"}`} style={{ background: "var(--glass-fill-strong)" }}>
      <div className="relative shrink-0">
        {active && (
          <>
            <span className="pointer-events-none absolute rounded-full" style={{ inset: -5, border: "1px solid var(--accent-soft)" }} />
            <span className="pointer-events-none absolute rounded-full" style={{ inset: -10, border: "1px solid var(--accent-soft)", opacity: 0.5 }} />
          </>
        )}
        <PhotoIconTile icon={icon} iconColor={iconColor} size={iconSize} photoUrl={photoUrl} alt={name} />
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
    <DeviceRow icon="lightbulb" iconColor="var(--accent)" name={device.name} error={device.error} large={large} active={Boolean(device.on)}>
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
  const target = device.targetTemp ?? device.currentTemp ?? 70;
  const dialSize = large ? 116 : 76;

  return (
    <DeviceRow icon="thermostat" iconColor="var(--accent)" name={device.name} error={device.error} large={large}>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {typeof device.currentTemp === "number" && (
          <span className="shrink-0 text-xs" style={{ color: "var(--ink-soft)" }}>{Math.round(device.currentTemp)}° now</span>
        )}
        <CircularDial
          value={target}
          min={CLIMATE_MIN}
          max={CLIMATE_MAX}
          onChange={onChange}
          size={dialSize}
          label={`${device.name} target temperature`}
        >
          <span className={`font-semibold tabular-nums ${large ? "text-xl" : "text-sm"}`} style={{ color: "var(--ink)" }}>
            {Math.round(target)}°
          </span>
        </CircularDial>
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
