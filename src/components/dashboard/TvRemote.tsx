"use client";

import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { mutate } from "swr";
import { Icon } from "@/components/Icon";
import { useRipple } from "@/hooks/useRipple";
import { useSnackbar } from "@/hooks/useSnackbar";
import { effects, spatial } from "@/lib/motion";
import type { BridgeDevice } from "@/app/api/live/home-status/route";

const HOME_STATUS_URL = "/api/live/home-status";
const VOLUME_STEP = 5;

// Mirrors homebridge-homehub's TvRemoteKey/StreamingApp unions — kept in
// sync by hand since the plugin is a separate package, same as the rest
// of this tile's device-shape assumptions.
type TvRemoteKey =
  | "rewind" | "fast_forward" | "next_track" | "previous_track"
  | "up" | "down" | "left" | "right" | "select" | "back" | "exit"
  | "play_pause" | "information";

type StreamingApp = "netflix" | "youtube" | "disney_plus" | "hulu" | "prime_video" | "max" | "apple_tv" | "spotify";

const APPS: { id: StreamingApp; label: string }[] = [
  { id: "netflix", label: "Netflix" },
  { id: "youtube", label: "YouTube" },
  { id: "disney_plus", label: "Disney+" },
  { id: "hulu", label: "Hulu" },
  { id: "prime_video", label: "Prime Video" },
  { id: "max", label: "Max" },
  { id: "apple_tv", label: "Apple TV" },
  { id: "spotify", label: "Spotify" },
];

async function sendCommand(deviceId: string, command: Record<string, unknown>) {
  const res = await fetch(HOME_STATUS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, command }),
  });
  if (!res.ok) throw new Error("Command failed");
}

function RemoteButton({
  icon,
  label,
  onPress,
  size = 52,
  iconSize = "h-6 w-6",
  primary = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  size?: number;
  iconSize?: string;
  primary?: boolean;
}) {
  const { onPointerDown, rippleLayer } = useRipple<HTMLButtonElement>();
  return (
    <button
      onClick={onPress}
      onPointerDown={onPointerDown}
      aria-label={label}
      className="ripple-surface relative flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: primary ? "var(--accent)" : "var(--glass-fill-strong)",
        color: primary ? "var(--on-accent)" : "var(--ink)",
      }}
    >
      {rippleLayer}
      <Icon name={icon} className={iconSize} filled={primary} />
    </button>
  );
}

/**
 * A dedicated full-screen control surface for one TV — the compact/expanded
 * Home Status row only has room for the basics (power, play/pause, mute,
 * volume dial); this adds real D-pad navigation and streaming-app shortcuts
 * on top of that, for when you actually want to drive the TV from here
 * instead of hunting for the physical remote.
 *
 * Portaled to <body> for the same reason as NewEventForm/ExpandedTileOverlay
 * — a `position: fixed` element inside a framer-motion-animated ancestor
 * loses viewport-relative positioning.
 */
export function TvRemote({ device, onClose }: { device: BridgeDevice; onClose: () => void }) {
  const showSnackbar = useSnackbar();

  async function run(command: Record<string, unknown>) {
    try {
      await sendCommand(device.id, command);
    }
    catch {
      showSnackbar("Couldn't reach the TV — check the bridge is still running");
    }
    mutate(HOME_STATUS_URL);
  }

  const sendKey = (key: TvRemoteKey) => run({ remoteKey: key });
  const on = Boolean(device.on);
  const playing = device.playback === "playing";
  const volume = device.volume ?? 0;

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={effects.default}
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.5)" }}
        aria-hidden="true"
      />
      <motion.section
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={spatial.slow}
        role="dialog"
        aria-label={`${device.name} remote`}
        className="glass-strong fixed inset-4 z-50 flex flex-col overflow-hidden p-6 sm:inset-x-[15%] sm:inset-y-[5%] lg:inset-x-[30%]"
        style={{ boxShadow: "var(--elevation-3)" }}
      >
        <header className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="m3-headline-small truncate" style={{ color: "var(--ink)" }}>{device.name}</h2>
            {on && device.nowPlaying && (
              <p className="truncate text-xs" style={{ color: "var(--ink-soft)" }}>{device.nowPlaying.title}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <RemoteButton
              icon="power_settings_new"
              label={on ? "Turn off" : "Turn on"}
              onPress={() => run({ on: !on })}
              size={44}
              iconSize="h-5 w-5"
              primary={on}
            />
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--glass-fill-strong)" }}
            >
              <Icon name="close" className="h-5 w-5" style={{ color: "var(--ink-soft)" }} />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto py-2">
          <div className="grid grid-cols-3 grid-rows-3 gap-2">
            <div />
            <RemoteButton icon="keyboard_arrow_up" label="Up" onPress={() => sendKey("up")} />
            <div />
            <RemoteButton icon="keyboard_arrow_left" label="Left" onPress={() => sendKey("left")} />
            <RemoteButton icon="check" label="Select" onPress={() => sendKey("select")} primary />
            <RemoteButton icon="keyboard_arrow_right" label="Right" onPress={() => sendKey("right")} />
            <div />
            <RemoteButton icon="keyboard_arrow_down" label="Down" onPress={() => sendKey("down")} />
            <div />
          </div>

          <div className="flex items-center gap-3">
            <RemoteButton icon="arrow_back" label="Back" onPress={() => sendKey("back")} size={44} iconSize="h-5 w-5" />
            <RemoteButton icon="home" label="Home" onPress={() => sendKey("exit")} size={44} iconSize="h-5 w-5" />
            <RemoteButton icon="info" label="Info" onPress={() => sendKey("information")} size={44} iconSize="h-5 w-5" />
          </div>

          <div className="flex items-center gap-3">
            <RemoteButton icon="skip_previous" label="Previous" onPress={() => sendKey("previous_track")} size={44} iconSize="h-5 w-5" />
            <RemoteButton icon="fast_rewind" label="Rewind" onPress={() => sendKey("rewind")} size={44} iconSize="h-5 w-5" />
            <RemoteButton icon={playing ? "pause" : "play_arrow"} label={playing ? "Pause" : "Play"} onPress={() => run({ playback: playing ? "paused" : "playing" })} primary />
            <RemoteButton icon="fast_forward" label="Fast forward" onPress={() => sendKey("fast_forward")} size={44} iconSize="h-5 w-5" />
            <RemoteButton icon="skip_next" label="Next" onPress={() => sendKey("next_track")} size={44} iconSize="h-5 w-5" />
          </div>

          <div className="flex items-center gap-3">
            <RemoteButton icon="volume_down" label="Volume down" onPress={() => run({ volume: Math.max(0, volume - VOLUME_STEP) })} size={44} iconSize="h-5 w-5" />
            <RemoteButton
              icon={device.muted ? "volume_off" : "volume_up"}
              label={device.muted ? "Unmute" : "Mute"}
              onPress={() => run({ muted: !device.muted })}
              size={44}
              iconSize="h-5 w-5"
            />
            <RemoteButton icon="volume_up" label="Volume up" onPress={() => run({ volume: Math.min(100, volume + VOLUME_STEP) })} size={44} iconSize="h-5 w-5" />
            <span className="ml-1 w-8 text-center text-xs font-semibold tabular-nums" style={{ color: "var(--ink-soft)" }}>{volume}</span>
          </div>

          <div className="flex w-full flex-wrap justify-center gap-2 pt-2">
            {APPS.map((app) => (
              <AppShortcut key={app.id} app={app} onPress={() => run({ launchApp: app.id })} />
            ))}
          </div>
        </div>
      </motion.section>
    </>,
    document.body,
  );
}

function AppShortcut({ app, onPress }: { app: { id: StreamingApp; label: string }; onPress: () => void }) {
  const { onPointerDown, rippleLayer } = useRipple<HTMLButtonElement>();
  return (
    <button
      onClick={onPress}
      onPointerDown={onPointerDown}
      className="ripple-surface relative overflow-hidden rounded-full px-4 py-2 text-xs font-semibold"
      style={{ background: "var(--surface-pill)", color: "var(--ink)" }}
    >
      {rippleLayer}
      {app.label}
    </button>
  );
}
