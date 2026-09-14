import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { configFor, refreshAccessToken } from "./oauth";
import { refreshSpotifyAccessToken } from "./spotify";
import type { Integration } from "@/generated/prisma/client";

const EXPIRY_SAFETY_MARGIN_MS = 60_000;

/**
 * Returns a usable access token for an OAuth integration, transparently
 * refreshing (and persisting) it when the stored one is expired or close to
 * expiring. Marks the integration needs_reauth if refresh fails so the
 * Settings UI can prompt the user to reconnect.
 */
export async function getValidAccessToken(integration: Integration): Promise<string | null> {
  if (!integration.accessTokenEnc) return null;

  const expiresAt = integration.tokenExpiresAt;
  const isExpired = expiresAt ? expiresAt.getTime() - EXPIRY_SAFETY_MARGIN_MS < Date.now() : false;

  if (!isExpired) return decryptSecret(integration.accessTokenEnc);
  if (!integration.refreshTokenEnc) return decryptSecret(integration.accessTokenEnc);

  try {
    const refreshToken = decryptSecret(integration.refreshTokenEnc);
    let accessToken: string;
    let nextRefreshToken: string | undefined;
    let expiresInSeconds: number | undefined;

    if (integration.provider === "spotify") {
      const refreshed = await refreshSpotifyAccessToken(refreshToken);
      accessToken = refreshed.access_token!;
      nextRefreshToken = refreshed.refresh_token;
      expiresInSeconds = refreshed.expires_in;
    } else {
      const refreshed = await refreshAccessToken(configFor(integration.provider), refreshToken);
      accessToken = refreshed.accessToken;
      nextRefreshToken = refreshed.refreshToken;
      expiresInSeconds = refreshed.expiresInSeconds;
    }

    await db.integration.update({
      where: { id: integration.id },
      data: {
        accessTokenEnc: encryptSecret(accessToken),
        refreshTokenEnc: nextRefreshToken ? encryptSecret(nextRefreshToken) : undefined,
        tokenExpiresAt: expiresInSeconds
          ? new Date(Date.now() + expiresInSeconds * 1000)
          : null,
        status: "connected",
        lastError: null,
      },
    });

    return accessToken;
  } catch (err) {
    await db.integration.update({
      where: { id: integration.id },
      data: { status: "needs_reauth", lastError: (err as Error).message },
    });
    return null;
  }
}
