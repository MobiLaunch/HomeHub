"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { mutate } from "swr";
import { CircularDial } from "@/components/CircularDial";
import { Icon } from "@/components/Icon";
import { PhotoIconTile } from "@/components/PhotoIconTile";
import { Switch } from "@/components/Switch";
import { TvRemote } from "@/components/dashboard/TvRemote";
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

async function pairDevice(deviceId: string) {
  const res = await fetch(HOME_STATUS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, pair: true }),
  });
  if (!res.ok) throw new Error("Pairing failed");
}

async function submitPairCode(deviceId: string, code: string) {
  const res = await fetch(HOME_STATUS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, pairCode: code }),
  });
  if (!res.ok) throw new Error("Incorrect code");
}

/** `expanded` is set inside the full-surface tile overlay — Home Status
 * just gets a little more breathing room there, not a different layout. */
export function HomeStatusTile({ expanded = false }: { expanded?: boolean }) {
  const { data, isLoading } = useLive<{ devices: BridgeDevice[] }>(HOME_STATUS_URL, 15_000);
  const devices = data?.devices ?? [];
  const showSnackbar = useSnackbar();
  const [remoteDeviceId, setRemoteDeviceId] = useState<string | null>(null);
  const remoteDevice = devices.find((d) => d.id === remoteDeviceId);

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
                  <DeviceRowByKind key={device.id} device={device} large={expanded} onUpdate={optimisticUpdate} onOpenRemote={setRemoteDeviceId} />
                ))}
              </Section>
            );
          })
        : (["climate", "lock", "light", "speaker", "tv"] as const).map((kind) => {
            const kindDevices = devices.filter((d) => d.kind === kind);
            if (kindDevices.length === 0) return null;
            return (
              <Section key={kind} title={KIND_TITLE[kind]}>
                {kindDevices.map((device) => (
                  <DeviceRowByKind key={device.id} device={device} large={expanded} onUpdate={optimisticUpdate} onOpenRemote={setRemoteDeviceId} />
                ))}
              </Section>
            );
          })}
      <AnimatePresence>
        {remoteDevice && <TvRemote key={remoteDevice.id} device={remoteDevice} onClose={() => setRemoteDeviceId(null)} />}
      </AnimatePresence>
    </div>
  );
}

const KIND_TITLE: Record<BridgeDevice["kind"], string> = { climate: "Climate", lock: "Locks", light: "Lights", speaker: "Speakers", tv: "TVs" };
const KIND_ORDER: Record<BridgeDevice["kind"], number> = { climate: 0, lock: 1, light: 2, speaker: 3, tv: 4 };
function byKindOrder(a: BridgeDevice, b: BridgeDevice) {
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
}

function DeviceRowByKind({ device, large, onUpdate, onOpenRemote }: {
  device: BridgeDevice;
  large?: boolean;
  onUpdate: (deviceId: string, patch: Partial<BridgeDevice>, command: Record<string, unknown>) => void;
  onOpenRemote: (deviceId: string) => void;
}) {
  if (device.kind === "light") {
    return <LightRow device={device} large={large} onToggle={(on) => onUpdate(device.id, { on }, { on })} />;
  }
  if (device.kind === "lock") {
    return <LockRow device={device} large={large} onToggle={() => onUpdate(device.id, { locked: !device.locked }, { locked: !device.locked })} />;
  }
  if (device.kind === "climate") {
    return <ClimateRow device={device} large={large} onChange={(targetTemp) => onUpdate(device.id, { targetTemp }, { targetTemp })} />;
  }
  if (device.kind === "speaker") {
    return (
      <SpeakerRow
        device={device}
        large={large}
        onPlayback={(playback) => onUpdate(device.id, { playback }, { playback })}
        onMute={(muted) => onUpdate(device.id, { muted }, { muted })}
        onVolume={(volume) => onUpdate(device.id, { volume }, { volume })}
      />
    );
  }
  if (device.pairingState && device.pairingState !== "paired") {
    return <TvPairingRow device={device} />;
  }
  return (
    <TvRow
      device={device}
      large={large}
      onToggle={(on) => onUpdate(device.id, { on }, { on })}
      onPlayback={(playback) => onUpdate(device.id, { playback }, { playback })}
      onMute={(muted) => onUpdate(device.id, { muted }, { muted })}
      onVolume={(volume) => onUpdate(device.id, { volume }, { volume })}
      onOpenRemote={() => onOpenRemote(device.id)}
    />
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

function DeviceRow({ icon, iconColor, name, error, subtitle, large, active, photoUrl, children }: {
  icon: string;
  iconColor: string;
  name: string;
  error?: string;
  /** A secondary line shown when there's no error — e.g. what's currently playing. */
  subtitle?: string;
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
        {!error && subtitle && (
          <p className="truncate text-[11px]" style={{ color: "var(--ink-soft)" }}>{subtitle}</p>
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

function nowPlayingSubtitle(device: BridgeDevice): string | undefined {
  if (device.nowPlaying) {
    return device.nowPlaying.subtitle ? `${device.nowPlaying.title} — ${device.nowPlaying.subtitle}` : device.nowPlaying.title;
  }
  return device.playback === "idle" ? "Nothing playing" : undefined;
}

function PlayPauseButton({ playback, onToggle }: { playback?: BridgeDevice["playback"]; onToggle: () => void }) {
  const { onPointerDown, rippleLayer } = useRipple<HTMLButtonElement>();
  const playing = playback === "playing";
  return (
    <button
      onClick={onToggle}
      onPointerDown={onPointerDown}
      disabled={!playback || playback === "idle"}
      className="ripple-surface relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full disabled:opacity-40"
      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      aria-label={playing ? `Pause` : `Play`}
    >
      {rippleLayer}
      <Icon name={playing ? "pause" : "play_arrow"} className="h-4 w-4" filled />
    </button>
  );
}

function MuteButton({ muted, onToggle }: { muted?: boolean; onToggle: () => void }) {
  const { onPointerDown, rippleLayer } = useRipple<HTMLButtonElement>();
  return (
    <button
      onClick={onToggle}
      onPointerDown={onPointerDown}
      className="ripple-surface relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{ background: "var(--surface-pill)", color: muted ? "var(--m3-error)" : "var(--ink-soft)" }}
      aria-label={muted ? "Unmute" : "Mute"}
    >
      {rippleLayer}
      <Icon name={muted ? "volume_off" : "volume_up"} className="h-4 w-4" />
    </button>
  );
}

function VolumeDial({ device, large, onVolume }: { device: BridgeDevice; large?: boolean; onVolume: (volume: number) => void }) {
  const dialSize = large ? 116 : 76;
  return (
    <CircularDial value={device.volume ?? 0} min={0} max={100} step={5} onChange={onVolume} size={dialSize} label={`${device.name} volume`}>
      <span className={`font-semibold tabular-nums ${large ? "text-xl" : "text-sm"}`} style={{ color: "var(--ink)" }}>
        {Math.round(device.volume ?? 0)}
      </span>
    </CircularDial>
  );
}

function SpeakerRow({ device, large, onPlayback, onMute, onVolume }: {
  device: BridgeDevice;
  large?: boolean;
  onPlayback: (playback: "playing" | "paused") => void;
  onMute: (muted: boolean) => void;
  onVolume: (volume: number) => void;
}) {
  return (
    <DeviceRow
      icon="speaker"
      iconColor="var(--accent)"
      name={device.name}
      error={device.error}
      subtitle={nowPlayingSubtitle(device)}
      large={large}
      active={device.playback === "playing"}
      photoUrl={device.nowPlaying?.imageUrl}
    >
      <div className="flex shrink-0 items-center gap-1.5">
        <PlayPauseButton playback={device.playback} onToggle={() => onPlayback(device.playback === "playing" ? "paused" : "playing")} />
        <MuteButton muted={device.muted} onToggle={() => onMute(!device.muted)} />
        <VolumeDial device={device} large={large} onVolume={onVolume} />
      </div>
    </DeviceRow>
  );
}

function RemoteButton({ onOpen }: { onOpen: () => void }) {
  const { onPointerDown, rippleLayer } = useRipple<HTMLButtonElement>();
  return (
    <button
      onClick={onOpen}
      onPointerDown={onPointerDown}
      className="ripple-surface relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{ background: "var(--surface-pill)", color: "var(--ink-soft)" }}
      aria-label="Open remote"
    >
      {rippleLayer}
      <Icon name="settings_remote" className="h-4 w-4" />
    </button>
  );
}

function TvRow({ device, large, onToggle, onPlayback, onMute, onVolume, onOpenRemote }: {
  device: BridgeDevice;
  large?: boolean;
  onToggle: (on: boolean) => void;
  onPlayback: (playback: "playing" | "paused") => void;
  onMute: (muted: boolean) => void;
  onVolume: (volume: number) => void;
  onOpenRemote: () => void;
}) {
  return (
    <DeviceRow
      icon="tv"
      iconColor="var(--accent)"
      name={device.name}
      error={device.error}
      subtitle={device.on ? nowPlayingSubtitle(device) : "Off"}
      large={large}
      active={Boolean(device.on)}
      photoUrl={device.nowPlaying?.imageUrl}
    >
      <div className="flex shrink-0 items-center gap-1.5">
        <Switch checked={Boolean(device.on)} onChange={onToggle} label={`${device.name} power`} />
        {device.on && (
          <>
            <PlayPauseButton playback={device.playback} onToggle={() => onPlayback(device.playback === "playing" ? "paused" : "playing")} />
            <MuteButton muted={device.muted} onToggle={() => onMute(!device.muted)} />
            <VolumeDial device={device} large={large} onVolume={onVolume} />
          </>
        )}
        <RemoteButton onOpen={onOpenRemote} />
      </div>
    </DeviceRow>
  );
}

/** A not-yet-paired Android TV shows a "Pair" affordance instead of controls — see androidtv.ts's PIN pairing flow. */
function TvPairingRow({ device }: { device: BridgeDevice }) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const showSnackbar = useSnackbar();
  const awaitingCode = device.pairingState === "awaiting_code";

  async function handlePair() {
    setSubmitting(true);
    try {
      await pairDevice(device.id);
      mutate(HOME_STATUS_URL);
    }
    catch {
      showSnackbar("Couldn't start pairing — check the bridge is still running");
    }
    finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    try {
      await submitPairCode(device.id, code.trim());
      setCode("");
      mutate(HOME_STATUS_URL);
    }
    catch {
      showSnackbar("That code didn't work — check the PIN on the TV and try again");
    }
    finally {
      setSubmitting(false);
    }
  }

  return (
    <DeviceRow icon="tv" iconColor="var(--ink-soft)" name={device.name} subtitle={awaitingCode ? "Enter the PIN shown on the TV" : "Needs pairing"}>
      {awaitingCode ? (
        <form onSubmit={handleSubmitCode} className="flex shrink-0 items-center gap-1.5">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="PIN"
            inputMode="numeric"
            className="w-16 rounded-full px-3 py-1.5 text-xs font-semibold outline-none"
            style={{ background: "var(--surface-pill)", color: "var(--ink)" }}
            aria-label={`${device.name} pairing PIN`}
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            Submit
          </button>
        </form>
      ) : (
        <button
          onClick={handlePair}
          disabled={submitting}
          className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          Pair
        </button>
      )}
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
