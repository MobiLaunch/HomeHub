import { createHash, randomBytes } from "crypto";

const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";

export const SPOTIFY_STATE_COOKIE = "__Host-homehub_spotify_state";
export const SPOTIFY_VERIFIER_COOKIE = "__Host-homehub_spotify_verifier";

export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-read-currently-playing",
  "user-read-recently-played",
] as const;

export function spotifyClientId(): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  if (!clientId) throw new Error("SPOTIFY_CLIENT_ID is not configured on this HomeHub deployment");
  return clientId;
}

export function spotifyRedirectUri(): string {
  const configured = process.env.APP_URL?.trim();
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const origin = configured
    ? configured.replace(/\/$/, "")
    : production
      ? `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
      : "http://127.0.0.1:3000";

  if (!origin.startsWith("https://") && !origin.startsWith("http://127.0.0.1")) {
    throw new Error("Spotify requires an HTTPS APP_URL (or http://127.0.0.1 for local development)");
  }
  return `${origin}/api/integrations/spotify/callback`;
}

export function createPkceVerifier(): string {
  return randomBytes(48).toString("base64url");
}

export function createPkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function createSpotifyState(): string {
  return randomBytes(32).toString("base64url");
}

export function buildSpotifyAuthorizeUrl(state: string, verifier: string, redirectUri = spotifyRedirectUri()): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: spotifyClientId(),
    scope: SPOTIFY_SCOPES.join(" "),
    redirect_uri: redirectUri,
    state,
    code_challenge_method: "S256",
    code_challenge: createPkceChallenge(verifier),
  });
  return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
}

type SpotifyTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

async function parseSpotifyResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text };
  }
}

function spotifyErrorMessage(status: number, body: Record<string, unknown>): string {
  const error = typeof body.error === "string" ? body.error : undefined;
  const description = typeof body.error_description === "string" ? body.error_description : undefined;
  const message = typeof body.message === "string" ? body.message : undefined;
  return `Spotify returned ${status}${error ? ` (${error})` : ""}: ${description ?? message ?? "Unknown error"}`;
}

export async function exchangeSpotifyCode(code: string, verifier: string, redirectUri = spotifyRedirectUri()): Promise<SpotifyTokenResponse> {
  const body = new URLSearchParams({
    client_id: spotifyClientId(),
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
  });
  const json = await parseSpotifyResponse(response);
  if (!response.ok) throw new Error(spotifyErrorMessage(response.status, json));
  if (typeof json.access_token !== "string") throw new Error("Spotify token response did not include an access token");

  return {
    access_token: json.access_token,
    refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : undefined,
    token_type: typeof json.token_type === "string" ? json.token_type : undefined,
    scope: typeof json.scope === "string" ? json.scope : undefined,
  };
}

export async function refreshSpotifyAccessToken(refreshToken: string): Promise<SpotifyTokenResponse> {
  const body = new URLSearchParams({
    client_id: spotifyClientId(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
  });
  const json = await parseSpotifyResponse(response);
  if (!response.ok) throw new Error(spotifyErrorMessage(response.status, json));
  if (typeof json.access_token !== "string") throw new Error("Spotify refresh response did not include an access token");

  return {
    access_token: json.access_token,
    refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : refreshToken,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : undefined,
    token_type: typeof json.token_type === "string" ? json.token_type : undefined,
    scope: typeof json.scope === "string" ? json.scope : undefined,
  };
}

export async function spotifyApi<T>(accessToken: string, path: string, init?: RequestInit): Promise<{ status: number; data: T | null }> {
  let delayMs = 500;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${SPOTIFY_API_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (response.status !== 429) {
      const json = response.status === 204 ? null : await parseSpotifyResponse(response);
      if (!response.ok) throw new Error(spotifyErrorMessage(response.status, json ?? {}));
      return { status: response.status, data: json as T | null };
    }

    const retryAfter = Number(response.headers.get("Retry-After"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter * 1000 : delayMs;
    if (attempt === 3) throw new Error("Spotify rate limit exceeded. Please try again shortly.");
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 10_000)));
    delayMs *= 2;
  }

  throw new Error("Spotify request failed");
}

export type SpotifyApiTrack = {
  id: string;
  name: string;
  duration_ms: number;
  external_urls?: { spotify?: string };
  artists?: { name: string }[];
  album?: { id: string; name: string; images?: { url: string }[] };
};

type PlaybackState = {
  is_playing?: boolean;
  progress_ms?: number | null;
  item?: SpotifyApiTrack | null;
};

type RecentlyPlayed = {
  items?: { track?: SpotifyApiTrack }[];
};

type AlbumTracks = { items?: SpotifyApiTrack[] };
type Album = { name?: string; images?: { url: string }[] };

export async function getSpotifyNowPlaying(accessToken: string): Promise<{ isPlaying: boolean; progressMs: number | null; track: SpotifyApiTrack } | null> {
  const playback = await spotifyApi<PlaybackState>(accessToken, "/me/player");
  if (playback.status === 204 || !playback.data?.item) return null;
  return {
    isPlaying: Boolean(playback.data.is_playing),
    progressMs: playback.data.progress_ms ?? null,
    track: playback.data.item,
  };
}

export async function getSpotifyRecentlyPlayed(accessToken: string): Promise<SpotifyApiTrack | null> {
  const recent = await spotifyApi<RecentlyPlayed>(accessToken, "/me/player/recently-played?limit=1");
  return recent.data?.items?.[0]?.track ?? null;
}

export async function getSpotifyAlbumTracks(accessToken: string, albumId: string): Promise<SpotifyApiTrack[]> {
  if (!albumId) return [];
  const tracks = await spotifyApi<AlbumTracks>(accessToken, `/albums/${encodeURIComponent(albumId)}/tracks?limit=10`);
  const album = await spotifyApi<Album>(accessToken, `/albums/${encodeURIComponent(albumId)}?fields=name%2Cimages`);
  const albumInfo = album.data ?? {};
  return (tracks.data?.items ?? []).map((track) => ({
    ...track,
    album: { id: albumId, name: albumInfo.name ?? "", images: albumInfo.images ?? [] },
  }));
}

export async function getSpotifyIdentity(accessToken: string): Promise<{ externalAccountId: string; label: string }> {
  const response = await spotifyApi<{ account_id?: string; id?: string; display_name?: string; email?: string }>(accessToken, "/me");
  const id = response.data?.account_id ?? response.data?.id;
  if (!id) throw new Error("Spotify profile response did not include an account identifier");
  return { externalAccountId: id, label: response.data?.display_name ?? response.data?.email ?? "Spotify account" };
}
