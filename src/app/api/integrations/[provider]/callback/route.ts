import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { PROVIDERS, isOAuthProvider } from "@/lib/integrations/registry";
import {
  exchangeCodeForTokens,
  exchangeFacebookPageAccess,
  fetchIdentity,
  OAUTH_STATE_COOKIE_PREFIX,
} from "@/lib/integrations/oauth";
import type { IntegrationProvider } from "@/generated/prisma/enums";

type OAuthState = {
  state: string;
  from: "setup" | "settings";
  redirectUri: string;
};

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

  let expectedState = "";
  let returnPath: "/setup" | "/settings" = "/settings";
  let redirectUri = `${url.origin}/api/integrations/${provider}/callback`;

  if (cookieValue) {
    try {
      const saved = JSON.parse(cookieValue) as Partial<OAuthState>;
      expectedState = typeof saved.state === "string" ? saved.state : "";
      returnPath = saved.from === "setup" ? "/setup" : "/settings";
      if (typeof saved.redirectUri === "string" && saved.redirectUri) {
        redirectUri = saved.redirectUri;
      }
    } catch {
      // Ignore malformed state cookies and fail validation below.
    }
  }

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`${returnPath}?error=${encodeURIComponent(oauthError)}`, url.origin),
    );
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL(`${returnPath}?error=invalid_state`, url.origin));
  }

  try {
    const tokens = await exchangeCodeForTokens(config, code, redirectUri);

    // Facebook Page data (comments, Messenger, insights) requires a Page
    // Access Token, not the user access token the standard exchange above
    // returns — swap it out here before anything is persisted.
    let externalAccountId: string;
    let label: string;
    let accessToken: string;
    let refreshToken: string | undefined;
    let expiresInSeconds: number | undefined;

    if (config.id === "facebook") {
      const page = await exchangeFacebookPageAccess(tokens.accessToken);
      externalAccountId = page.pageId;
      label = page.pageName;
      accessToken = page.pageAccessToken;
      refreshToken = undefined;
      expiresInSeconds = undefined;
    } else {
      const identity = await fetchIdentity(config.id, tokens.accessToken);
      externalAccountId = identity.externalAccountId;
      label = identity.label;
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
      expiresInSeconds = tokens.expiresInSeconds;
    }

    await db.integration.upsert({
      where: {
        provider_externalAccountId: {
          provider: config.id,
          externalAccountId,
        },
      },
      create: {
        provider: config.id,
        externalAccountId,
        label,
        status: "connected",
        accessTokenEnc: encryptSecret(accessToken),
        refreshTokenEnc: refreshToken ? encryptSecret(refreshToken) : null,
        tokenExpiresAt: expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null,
      },
      update: {
        label,
        status: "connected",
        accessTokenEnc: encryptSecret(accessToken),
        refreshTokenEnc: refreshToken ? encryptSecret(refreshToken) : undefined,
        tokenExpiresAt: expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null,
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
