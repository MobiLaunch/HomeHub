"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useLive } from "@/hooks/useLive";
import { useReportActivity } from "@/hooks/useTileActivity";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";
import type { SpotifyNowPlaying, SpotifyTrack } from "@/lib/integrations/spotify-live";

function formatDuration(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function SpotifyWidget() {
  const { data, isLoading } = useLive<{ nowPlaying: SpotifyNowPlaying[] }>("/api/live/spotify", 20_000);
  const [expanded, setExpanded] = useState(false);
  const current = data?.nowPlaying?.[0];

  const spotifyConnected = Boolean(data?.nowPlaying && data.nowPlaying.length > 0);
  const player = useSpotifyPlayer(spotifyConnected);
  const isLocalDevice = player.state !== null;

  // Once this tab is the active Spotify Connect device, its own state is
  // the source of truth (updates instantly, not on the 20s poll).
  const isPlayingNow = isLocalDevice ? !player.state!.isPaused : Boolean(current?.isPlaying);

  useReportActivity("spotify", isPlayingNow ? 100 : 0, isPlayingNow);

  const displayPosition = useLiveProgress(
    isLocalDevice ? player.state!.positionMs : (current?.progressMs ?? 0),
    isPlayingNow,
  );

  if (isLoading && !current) {
    return <EmptyState text="Checking Spotify…" />;
  }
  if (!current) {
    return <EmptyState text="Connect Spotify in Settings to see what's playing." />;
  }

  const track = isLocalDevice ? player.state!.track : current.track;
  const albumTracks = current.albumTracks;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button onClick={() => setExpanded((e) => !e)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className="relative h-16 w-16 shrink-0">
            {track.albumArtUrl ? (
              <Image
                src={track.albumArtUrl}
                alt={track.albumName}
                width={64}
                height={64}
                className="h-16 w-16 rounded-xl object-cover"
                style={{ boxShadow: "var(--elevation-1)" }}
              />
            ) : (
              <div className="h-16 w-16 rounded-xl" style={{ background: "var(--surface-pill)" }} />
            )}
            <div
              className="spotify-record absolute -right-3 -top-3 h-10 w-10 rounded-full"
              style={{ animationPlayState: isPlayingNow ? "running" : "paused" }}
            >
              <div className="absolute inset-0 m-auto h-3 w-3 rounded-full" style={{ background: "var(--m3-tertiary)" }} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {track.name}
            </p>
            <p className="truncate text-xs" style={{ color: "var(--ink-soft)" }}>
              {track.artists}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: "var(--ink-soft)" }}>
              <Icon name={isPlayingNow ? "graphic_eq" : "pause"} className="h-3 w-3" />
              {isLocalDevice ? "Playing on HomeHub" : isPlayingNow ? "Now playing" : "Last played"}
            </p>
          </div>
        </button>
        <motion.button
          onClick={() => setExpanded((e) => !e)}
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 24 }}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <Icon name="expand_more" className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
        </motion.button>
      </div>

      {isLocalDevice ? (
        <PlayerControls
          positionMs={displayPosition}
          durationMs={track.durationMs}
          isPaused={player.state!.isPaused}
          onTogglePlay={player.togglePlay}
          onNext={player.nextTrack}
          onPrevious={player.previousTrack}
          onSeek={player.seek}
        />
      ) : (
        player.isReady && (
          <button
            onClick={player.transferHere}
            className="glass-pill flex items-center justify-center gap-1.5 self-start px-3.5 py-1.5 text-xs font-medium"
            style={{ color: "var(--accent)" }}
          >
            <Icon name="play_circle" className="h-3.5 w-3.5" />
            Play here
          </button>
        )
      )}

      {player.error && (
        <p className="text-[11px]" style={{ color: "var(--m3-error)" }}>
          {player.error}
        </p>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 1, 1] }}
            className="overflow-hidden"
          >
            <p className="mb-1.5 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
              More from {track.albumName}
            </p>
            {albumTracks.length > 0 ? (
              <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto pr-1">
                {albumTracks.map((t) => (
                  <SpotifyTrackRow key={t.id} track={t} active={t.id === current.track.id} />
                ))}
              </ul>
            ) : (
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                No other tracks found for this album.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: "var(--glass-border)" }}>
        <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>
          Music from
        </span>
        <a
          href={current.track.externalUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-transform active:scale-95"
          style={{ color: "var(--ink)" }}
          aria-label="Open this track on Spotify"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1db954] text-[9px] text-white" aria-hidden="true">●</span>
          Spotify
        </a>
      </div>
    </div>
  );
}

const PROGRESS_TICK_MS = 500;

/** Interpolates playback position between the SDK's state updates (which
 * arrive roughly once a second, not smoothly) so the progress bar doesn't
 * visibly stall between them. Anchors to `positionMs` whenever it changes
 * (tracked via the "previous render" state pattern, not an effect) and ticks
 * forward from there while playing. */
function useLiveProgress(positionMs: number, isPlaying: boolean) {
  const [tick, setTick] = useState(0);
  const [anchorPosition, setAnchorPosition] = useState(positionMs);
  const [anchorTick, setAnchorTick] = useState(0);

  if (anchorPosition !== positionMs) {
    setAnchorPosition(positionMs);
    setAnchorTick(tick);
  }

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setTick((t) => t + 1), PROGRESS_TICK_MS);
    return () => clearInterval(id);
  }, [isPlaying]);

  return anchorPosition + (tick - anchorTick) * PROGRESS_TICK_MS;
}

function PlayerControls({
  positionMs,
  durationMs,
  isPaused,
  onTogglePlay,
  onNext,
  onPrevious,
  onSeek,
}: {
  positionMs: number;
  durationMs: number;
  isPaused: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (ms: number) => void;
}) {
  const fraction = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * durationMs);
        }}
        className="group relative h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--glass-fill-strong)" }}
        aria-label="Seek"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${fraction * 100}%`, background: "var(--accent)" }}
        />
      </button>
      <div className="flex items-center justify-between">
        <span className="text-[10px] tabular-nums" style={{ color: "var(--ink-soft)" }}>
          {formatDuration(positionMs)}
        </span>
        <div className="flex items-center gap-3">
          <button onClick={onPrevious} aria-label="Previous track">
            <Icon name="skip_previous" className="h-4 w-4" style={{ color: "var(--ink)" }} />
          </button>
          <button
            onClick={onTogglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: "var(--accent)" }}
            aria-label={isPaused ? "Play" : "Pause"}
          >
            <Icon name={isPaused ? "play_arrow" : "pause"} className="h-4 w-4" style={{ color: "var(--on-accent)" }} filled />
          </button>
          <button onClick={onNext} aria-label="Next track">
            <Icon name="skip_next" className="h-4 w-4" style={{ color: "var(--ink)" }} />
          </button>
        </div>
        <span className="text-[10px] tabular-nums" style={{ color: "var(--ink-soft)" }}>
          {formatDuration(durationMs)}
        </span>
      </div>
    </div>
  );
}

function SpotifyTrackRow({ track, active }: { track: SpotifyTrack; active: boolean }) {
  return (
    <li>
      <a
        href={track.externalUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs"
        style={{ background: active ? "var(--accent-soft)" : "var(--glass-fill-strong)" }}
      >
        <span
          className="min-w-0 flex-1 truncate"
          style={{ color: active ? "var(--m3-on-primary-container)" : "var(--ink)" }}
        >
          {track.name}
        </span>
        <span className="shrink-0" style={{ color: "var(--ink-soft)" }}>
          {formatDuration(track.durationMs)}
        </span>
        <Icon name="open_in_new" className="h-3 w-3 shrink-0" style={{ color: "var(--ink-soft)" }} />
      </a>
    </li>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
      <Icon name="graphic_eq" className="h-5 w-5" style={{ color: "var(--ink-soft)" }} />
      <p className="max-w-[220px] text-xs" style={{ color: "var(--ink-soft)" }}>
        {text}
      </p>
    </div>
  );
}
