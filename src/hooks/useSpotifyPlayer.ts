"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpotifyPlayerTrack = {
  name: string;
  artists: string;
  albumName: string;
  albumArtUrl: string | null;
  durationMs: number;
};

export type SpotifyPlayerState = {
  track: SpotifyPlayerTrack;
  isPaused: boolean;
  positionMs: number;
};

type SpotifyWebPlaybackTrack = {
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
};

type SpotifyWebPlaybackState = {
  paused: boolean;
  position: number;
  duration: number;
  track_window: { current_track: SpotifyWebPlaybackTrack };
};

type SpotifyPlayerErrorEvent = { message: string };

type SpotifyWebPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener(event: "ready" | "not_ready", cb: (data: { device_id: string }) => void): void;
  addListener(event: "player_state_changed", cb: (state: SpotifyWebPlaybackState | null) => void): void;
  addListener(
    event: "initialization_error" | "authentication_error" | "account_error" | "playback_error",
    cb: (data: SpotifyPlayerErrorEvent) => void,
  ): void;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
};

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyWebPlayer;
    };
  }
}

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";

async function fetchSpotifyToken(): Promise<string | null> {
  const res = await fetch("/api/live/spotify/token");
  if (!res.ok) return null;
  const json = (await res.json()) as { accessToken?: string };
  return json.accessToken ?? null;
}

/**
 * Wraps Spotify's Web Playback SDK so this browser tab can register itself
 * as a Spotify Connect device and control playback in-app. Requires a
 * Premium account — a free account can connect fine but every playback call
 * fails with an `account_error`, surfaced via the returned `error`.
 */
export function useSpotifyPlayer(enabled: boolean) {
  const [isReady, setIsReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [state, setState] = useState<SpotifyPlayerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<SpotifyWebPlayer | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    function createPlayer() {
      if (cancelled || !window.Spotify || playerRef.current) return;
      const player = new window.Spotify.Player({
        name: "HomeHub",
        getOAuthToken: (cb) => {
          fetchSpotifyToken().then((token) => {
            if (token) cb(token);
          });
        },
        volume: 0.6,
      });
      playerRef.current = player;

      player.addListener("ready", ({ device_id }) => {
        if (cancelled) return;
        setDeviceId(device_id);
        setIsReady(true);
      });
      player.addListener("not_ready", () => {
        if (cancelled) return;
        setIsReady(false);
      });
      player.addListener("player_state_changed", (s) => {
        if (cancelled) return;
        if (!s) {
          setState(null);
          return;
        }
        const item = s.track_window.current_track;
        setState({
          track: {
            name: item.name,
            artists: item.artists.map((a) => a.name).join(", "),
            albumName: item.album.name,
            albumArtUrl: item.album.images[0]?.url ?? null,
            durationMs: s.duration,
          },
          isPaused: s.paused,
          positionMs: s.position,
        });
      });
      player.addListener("initialization_error", ({ message }) => setError(message));
      player.addListener("authentication_error", ({ message }) => setError(message));
      player.addListener("account_error", () =>
        setError("This Spotify account can't play music in-browser — Web Playback requires Premium."),
      );
      player.addListener("playback_error", ({ message }) => setError(message));

      player.connect();
    }

    if (window.Spotify) {
      createPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = createPlayer;
      if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
        const script = document.createElement("script");
        script.src = SDK_SRC;
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
      setIsReady(false);
      setDeviceId(null);
    };
  }, [enabled]);

  const togglePlay = useCallback(() => {
    void playerRef.current?.togglePlay();
  }, []);
  const nextTrack = useCallback(() => {
    void playerRef.current?.nextTrack();
  }, []);
  const previousTrack = useCallback(() => {
    void playerRef.current?.previousTrack();
  }, []);
  const seek = useCallback((ms: number) => {
    void playerRef.current?.seek(ms);
  }, []);

  const transferHere = useCallback(async () => {
    if (!deviceId) return;
    const token = await fetchSpotifyToken();
    if (!token) return;
    await fetch("https://api.spotify.com/v1/me/player", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ device_ids: [deviceId], play: true }),
    });
  }, [deviceId]);

  return { isReady, deviceId, state, error, togglePlay, nextTrack, previousTrack, seek, transferHere };
}
