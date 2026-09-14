import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import {
  exchangeSpotifyCode,
  getSpotifyIdentity,
  SPOTIFY_STATE_COOKIE,
  SPOTIFY_VERIFIER_COOKIE,
} from "@/lib/integrations/spotify";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const cookieStore = await cookies();

  const stateCookie = cookieStore.get(SPOTIFY_STATE_COOKIE)?.value;
  const verifier = cookieStore.get(SPOTIFY_VERIFIER_COOKIE)?.value;
  cookieStore.delete(SPOTIFY_STATE_COOKIE);
  cookieStore.delete(SPOTIFY_VERIFIER_COOKIE);

  let expectedState = "";
  let returnPath: "/setup" | "/settings" = "/settings";
  if (stateCookie) {
    try {
      const saved = JSON.parse(stateCookie) as { state?: unknown; from?: unknown };
      expectedState = typeof saved.state === "string" ? saved.state : "";
      returnPath = saved.from === "setup" ? "/setup" : "/settings";
    } catch {
      // Validation below intentionally fails malformed state cookies.
    }
  }

  const fail = (message: string) => {
    const destination = new URL(returnPath, url.origin);
    destination.searchParams.set("error", message);
    return NextResponse.redirect(destination);
  };

  if (oauthError) return fail(`Spotify authorization was not completed: ${oauthError}`);
  if (!code || !state || !expectedState || state !== expectedState) return fail("invalid_state");
  if (!verifier) return fail("Spotify authorization expired. Please connect Spotify again.");

  try {
    const tokens = await exchangeSpotifyCode(code, verifier);
    const identity = await getSpotifyIdentity(tokens.access_token!);

    await db.integration.upsert({
      where: {
        provider_externalAccountId: {
          provider: "spotify",
          externalAccountId: identity.externalAccountId,
        },
      },
      create: {
        provider: "spotify",
        externalAccountId: identity.externalAccountId,
        label: identity.label,
        status: "connected",
        accessTokenEnc: encryptSecret(tokens.access_token!),
        refreshTokenEnc: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      },
      update: {
        label: identity.label,
        status: "connected",
        accessTokenEnc: encryptSecret(tokens.access_token!),
        refreshTokenEnc: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : undefined,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        lastError: null,
      },
    });

    const destination = new URL(returnPath, url.origin);
    destination.searchParams.set("connected", "spotify");
    return NextResponse.redirect(destination);
  } catch (error) {
    return fail((error as Error).message);
  }
}
