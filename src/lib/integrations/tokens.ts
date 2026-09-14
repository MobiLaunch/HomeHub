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
    const accessToken = integration.provider === "spotify"
      ? await refreshSpotifyAccessToken(refreshToken)
      : await refreshAccessToken(configFor(integration.provider), refreshToken);

    const normalized = integration.provider === "spotify"
      ? {
          accessToken: accessToken.access_token!,
          refreshToken: accessToken.refresh_token,
          expiresInSeconds: accessToken.expires_in,
        }
      : {
          accessToken: accessToken.accessToken,
          refreshToken: accessToken.refreshToken,
          expiresInSeconds: accessToken.expiresInSeconds,
        };

    await db.integration.update({
      where: { id: integration.id },
      data: {
        accessTokenEnc: encryptSecret(normalized.accessToken),
        refreshTokenEnc: normalized.refreshToken
          ? encryptSecret(normalized.refreshToken)
          : undefined,
        tokenExpiresAt: normalized.expiresInSeconds
          ? new Date(Date.now() + normalized.expiresInSeconds * 1000)
          : null,
        status: "connected",
        lastError: null,
      },
    });

    return normalized.accessToken;
  } catch (err) {
    await db.integration.update({
      where: { id: integration.id },
      data: { status: "needs_reauth", lastError: (err as Error).message },
    });
    return null;
  }
}
