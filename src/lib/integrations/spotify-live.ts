import { db } from "@/lib/db";
import { getValidAccessToken } from "./tokens";
import {
  getSpotifyAlbumTracks,
  getSpotifyNowPlaying,
  getSpotifyRecentlyPlayed,
  type SpotifyApiTrack,
} from "./spotify";

export type SpotifyTrack = {
  id: string;
  name: string;
  artists: string;
  albumId: string;
  albumName: string;
  albumArtUrl: string | null;
  durationMs: number;
  externalUrl: string;
};

export type SpotifyNowPlaying = {
  isPlaying: boolean;
  progressMs: number | null;
  track: SpotifyTrack;
  albumTracks: SpotifyTrack[];
  accountLabel: string;
};

function mapTrack(track: SpotifyApiTrack): SpotifyTrack {
  return {
    id: track.id,
    name: track.name,
    artists: (track.artists ?? []).map((artist) => artist.name).join(", "),
    albumId: track.album?.id ?? "",
    albumName: track.album?.name ?? "",
    albumArtUrl: track.album?.images?.[0]?.url ?? null,
    durationMs: track.duration_ms,
    externalUrl: track.external_urls?.spotify ?? "https://open.spotify.com",
  };
}

export async function fetchSpotifyNowPlaying(): Promise<SpotifyNowPlaying[]> {
  const integrations = await db.integration.findMany({
    where: { provider: "spotify", status: { in: ["connected", "error"] } },
  });

  const results = await Promise.all(
    integrations.map(async (integration) => {
      try {
        const token = await getValidAccessToken(integration);
        if (!token) return null;

        const playback = await getSpotifyNowPlaying(token);
        const sourceTrack = playback?.track ?? await getSpotifyRecentlyPlayed(token);
        if (!sourceTrack) {
          await markSpotifySynced(integration.id);
          return null;
        }

        const albumTracks = sourceTrack.album?.id
          ? await getSpotifyAlbumTracks(token, sourceTrack.album.id)
          : [];

        await markSpotifySynced(integration.id);
        return {
          isPlaying: playback?.isPlaying ?? false,
          progressMs: playback?.progressMs ?? null,
          track: mapTrack(sourceTrack),
          albumTracks: albumTracks.map(mapTrack),
          accountLabel: integration.label,
        };
      } catch (error) {
        await markSpotifySynced(integration.id, (error as Error).message);
        return null;
      }
    }),
  );

  return results.filter((result): result is SpotifyNowPlaying => result !== null);
}

async function markSpotifySynced(integrationId: string, error?: string) {
  await db.integration.update({
    where: { id: integrationId },
    data: {
      lastSyncedAt: new Date(),
      lastError: error ?? null,
      status: error ? "error" : "connected",
    },
  });
}
