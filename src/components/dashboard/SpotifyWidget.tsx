"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useLive } from "@/hooks/useLive";
import { useReportActivity } from "@/hooks/useTileActivity";
import type { SpotifyNowPlaying, SpotifyTrack } from "@/lib/integrations/live";

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
  const isPlayingNow = Boolean(current?.isPlaying);

  // Actively playing music is the whole point of this tile being on the
  // dashboard at all — worth surfacing bigger and higher than a tile that's
  // just sitting on a track someone finished listening to an hour ago.
  useReportActivity("spotify", isPlayingNow ? 100 : 0, isPlayingNow);

  if (isLoading && !current) {
    return <EmptyState text="Checking Spotify…" />;
  }
  if (!current) {
    return <EmptyState text="Connect Spotify in Settings to see what's playing." />;
  }

  const { track, isPlaying, albumTracks } = current;

  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => setExpanded((e) => !e)} className="flex items-center gap-3 text-left">
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
          {/* Spinning vinyl record, peeking out from behind the album art —
              spins while playing, frozen mid-spin (not hidden) once paused
              so it still reads as "a record", just resting. */}
          <div
            className="spotify-record absolute -right-3 -top-3 h-10 w-10 rounded-full"
            style={{ animationPlayState: isPlaying ? "running" : "paused" }}
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
            <Icon name={isPlaying ? "graphic_eq" : "pause"} className="h-3 w-3" />
            {isPlaying ? "Now playing" : "Last played"}
          </p>
        </div>
        <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 24 }}>
          <Icon name="expand_more" className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="mb-1.5 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
              More from {track.albumName}
            </p>
            {albumTracks.length > 0 ? (
              <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto pr-1">
                {albumTracks.map((t) => (
                  <SpotifyTrackRow key={t.id} track={t} active={t.id === track.id} />
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
