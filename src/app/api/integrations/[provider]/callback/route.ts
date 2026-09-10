import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { PROVIDERS, isOAuthProvider } from "@/lib/integrations/registry";
import { exchangeCodeForTokens, fetchIdentity, OAUTH_STATE_COOKIE_PREFIX } from "@/lib/integrations/oauth";
import type { IntegrationProvider } from "@/generated/prisma/enums";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const config = PROVIDERS[provider as IntegrationProvider];
  if (!config || !isOAuthProvider(config)) {
    return NextResponse.json({ error: "Unknown or non-OAuth provider" }, { status: 400 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieStore = await cookies();
  const cookieName = `${OAUTH_STATE_COOKIE_PREFIX}${provider}`;
  const cookieValue = cookieStore.get(cookieName)?.value;
  cookieStore.delete(cookieName);
  const [expectedState, from] = (cookieValue ?? "").split(":");
  const returnPath = from === "setup" ? "/setup" : "/settings";

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`${returnPath}?error=${encodeURIComponent(oauthError)}`, url.origin),
    );
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL(`${returnPath}?error=invalid_state`, url.origin));
  }

  try {
    const tokens = await exchangeCodeForTokens(config, code);
    const identity = await fetchIdentity(config.id, tokens.accessToken);

    await db.integration.upsert({
      where: {
        provider_externalAccountId: {
          provider: config.id,
          externalAccountId: identity.externalAccountId,
        },
      },
      create: {
        provider: config.id,
        externalAccountId: identity.externalAccountId,
        label: identity.label,
        status: "connected",
        accessTokenEnc: encryptSecret(tokens.accessToken),
        refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
        tokenExpiresAt: tokens.expiresInSeconds
          ? new Date(Date.now() + tokens.expiresInSeconds * 1000)
          : null,
      },
      update: {
        label: identity.label,
        status: "connected",
        accessTokenEnc: encryptSecret(tokens.accessToken),
        refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : undefined,
        tokenExpiresAt: tokens.expiresInSeconds
          ? new Date(Date.now() + tokens.expiresInSeconds * 1000)
          : null,
        lastError: null,
      },
    });

    return NextResponse.redirect(new URL(`${returnPath}?connected=${config.id}`, url.origin));
  } catch (err) {
    return NextResponse.redirect(
      new URL(`${returnPath}?error=${encodeURIComponent((err as Error).message)}`, url.origin),
    );
  }
}
