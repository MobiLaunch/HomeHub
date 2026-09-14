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
    // Fail before redirecting if the deployment has not been configured with
    // its Spotify app. The UI uses this same configuration check, but keeping
    // the server-side guard makes the endpoint safe to call directly.
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

    // Keep the exact redirect URI alongside the OAuth state. Spotify requires
    // the redirect_uri in the authorization request and token exchange to be
    // byte-for-byte identical, including trailing slashes/casing.
    cookieStore.set(
      SPOTIFY_STATE_COOKIE,
      JSON.stringify({ state, from, redirectUri }),
      cookieOptions,
    );
    cookieStore.set(SPOTIFY_VERIFIER_COOKIE, verifier, cookieOptions);

    return NextResponse.redirect(buildSpotifyAuthorizeUrl(state, verifier));
  } catch (error) {
    const destination = new URL(from === "setup" ? "/setup" : "/settings", requestUrl.origin);
    destination.searchParams.set("error", (error as Error).message);
    return NextResponse.redirect(destination);
  }
}
