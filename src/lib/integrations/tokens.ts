import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { configFor, refreshAccessToken } from "./oauth";
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

  if (!isExpired) {
    return decryptSecret(integration.accessTokenEnc);
  }

  if (!integration.refreshTokenEnc) {
    // No refresh token available (e.g. Slack tokens don't expire by default)
    // — treat the stored token as still usable.
    return decryptSecret(integration.accessTokenEnc);
  }

  try {
    const config = configFor(integration.provider);
    const refreshToken = decryptSecret(integration.refreshTokenEnc);
    const refreshed = await refreshAccessToken(config, refreshToken);
    await db.integration.update({
      where: { id: integration.id },
      data: {
        accessTokenEnc: encryptSecret(refreshed.accessToken),
        refreshTokenEnc: refreshed.refreshToken ? encryptSecret(refreshed.refreshToken) : undefined,
        tokenExpiresAt: refreshed.expiresInSeconds
          ? new Date(Date.now() + refreshed.expiresInSeconds * 1000)
          : null,
        status: "connected",
        lastError: null,
      },
    });
    return refreshed.accessToken;
  } catch (err) {
    await db.integration.update({
      where: { id: integration.id },
      data: { status: "needs_reauth", lastError: (err as Error).message },
    });
    return null;
  }
}
