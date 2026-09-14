import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildSpotifyAuthorizeUrl,
  createPkceVerifier,
  createSpotifyState,
  SPOTIFY_STATE_COOKIE,
  SPOTIFY_VERIFIER_COOKIE,
  spotifyClientId,
  spotifyRedirectUri,
} from "@/lib/integrations/spotify";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const from = requestUrl.searchParams.get("from") === "setup" ? "setup" : "settings";

  try {
    spotifyClientId();
    const redirectUri = spotifyRedirectUri();
    const state = createSpotifyState();
    const verifier = createPkceVerifier();
    const cookieStore = await cookies();

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 600,
      path: "/",
    };

    // Spotify requires the redirect_uri used during authorization to exactly
    // match the redirect_uri used during token exchange. Capture the value
    // alongside the state so the callback cannot accidentally recompute a
    // different URI after the external redirect.
    cookieStore.set(
      SPOTIFY_STATE_COOKIE,
      JSON.stringify({ state, from, redirectUri }),
      cookieOptions,
    );
    cookieStore.set(SPOTIFY_VERIFIER_COOKIE, verifier, cookieOptions);

    return NextResponse.redirect(buildSpotifyAuthorizeUrl(state, verifier, redirectUri));
  } catch (error) {
    const destination = new URL(from === "setup" ? "/setup" : "/settings", requestUrl.origin);
    destination.searchParams.set("error", (error as Error).message);
    return NextResponse.redirect(destination);
  }
}
