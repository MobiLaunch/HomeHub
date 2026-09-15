import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getValidAccessToken } from "@/lib/integrations/tokens";

/**
 * Hands the browser a short-lived Spotify access token so the Web Playback
 * SDK's `getOAuthToken` callback (and direct calls to Spotify's Web API for
 * play/pause/skip) can authenticate — the refresh token never leaves the
 * server. Requires the `streaming` and `user-modify-playback-state` scopes,
 * so an account connected before those were added needs to reconnect.
 */
export async function GET() {
  const integration = await db.integration.findFirst({
    where: { provider: "spotify", status: { in: ["connected", "error"] } },
  });
  if (!integration) {
    return NextResponse.json({ error: "Spotify not connected" }, { status: 404 });
  }
  const accessToken = await getValidAccessToken(integration);
  if (!accessToken) {
    return NextResponse.json({ error: "Spotify needs to be reconnected" }, { status: 401 });
  }
  return NextResponse.json({ accessToken });
}
