import { randomBytes } from "crypto";
import {
  PROVIDERS,
  providerClientId,
  providerClientSecret,
  redirectUriFor,
  type OAuthProviderConfig,
} from "./registry";
import type { IntegrationProvider } from "@/generated/prisma/enums";

export const OAUTH_STATE_COOKIE_PREFIX = "__Host-homehub_oauth_state_";

export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthorizeUrl(
  config: OAuthProviderConfig,
  state: string,
  redirectUri?: string,
): string {
  const clientId = providerClientId(config);
  if (!clientId) {
    throw new Error(`${config.clientIdEnv} is not configured`);
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri ?? redirectUriFor(config.id),
    response_type: "code",
    state,
    ...config.extraAuthorizeParams,
  });
  if (config.scopes.length > 0) {
    params.set("scope", config.scopes.join(config.id === "slack" ? "," : " "));
  }
  if (config.userScopeParam) {
    params.set("user_scope", config.userScopeParam);
  }
  return `${config.authorizeUrl}?${params.toString()}`;
}

export type ExchangedTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds?: number;
  raw: unknown;
};

export async function exchangeCodeForTokens(
  config: OAuthProviderConfig,
  code: string,
  redirectUri?: string,
): Promise<ExchangedTokens> {
  const clientId = providerClientId(config);
  const clientSecret = providerClientSecret(config);
  if (!clientId || !clientSecret) {
    throw new Error(`${config.id} OAuth client is not configured`);
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri ?? redirectUriFor(config.id),
    grant_type: "authorization_code",
  });

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Token exchange failed for ${config.id}: ${JSON.stringify(json)}`);
  }

  if (config.id === "slack") {
    const authedUser = json.authed_user as
      | { access_token?: string; refresh_token?: string; expires_in?: number }
      | undefined;
    if (!json.ok) {
      throw new Error(`Slack OAuth error: ${JSON.stringify(json)}`);
    }
    const token = authedUser?.access_token;
    if (!token) {
      throw new Error("Slack OAuth response missing authed_user access token");
    }
    return {
      accessToken: token,
      refreshToken: authedUser?.refresh_token,
      expiresInSeconds: authedUser?.expires_in,
      raw: json,
    };
  }

  const accessToken = json.access_token as string | undefined;
  if (!accessToken) {
    throw new Error(`${config.id} token response missing access_token`);
  }
  return {
    accessToken,
    refreshToken: json.refresh_token as string | undefined,
    expiresInSeconds: json.expires_in as number | undefined,
    raw: json,
  };
}

export async function refreshAccessToken(
  config: OAuthProviderConfig,
  refreshToken: string,
): Promise<ExchangedTokens> {
  const clientId = providerClientId(config);
  const clientSecret = providerClientSecret(config);
  if (!clientId || !clientSecret) {
    throw new Error(`${config.id} OAuth client is not configured`);
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Token refresh failed for ${config.id}: ${JSON.stringify(json)}`);
  }
  return {
    accessToken: json.access_token as string,
    refreshToken: (json.refresh_token as string | undefined) ?? refreshToken,
    expiresInSeconds: json.expires_in as number | undefined,
    raw: json,
  };
}

export type ProviderIdentity = { externalAccountId: string; label: string };

export async function fetchIdentity(
  provider: IntegrationProvider,
  accessToken: string,
): Promise<ProviderIdentity> {
  switch (provider) {
    case "google": {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      return { externalAccountId: json.id, label: json.email ?? "Google account" };
    }
    case "microsoft": {
      const res = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      return {
        externalAccountId: json.id,
        label: json.mail ?? json.userPrincipalName ?? "Microsoft account",
      };
    }
    case "slack": {
      const res = await fetch("https://slack.com/api/auth.test", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      return {
        externalAccountId: `${json.team_id}:${json.user_id}`,
        label: json.team ? `${json.team} (${json.user})` : "Slack workspace",
      };
    }
    case "spotify": {
      const res = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      return { externalAccountId: json.id, label: json.display_name ?? "Spotify account" };
    }
    default:
      throw new Error(`fetchIdentity not supported for ${provider}`);
  }
}

export function configFor(provider: IntegrationProvider): OAuthProviderConfig {
  const config = PROVIDERS[provider];
  if (config.authType !== "oauth") {
    throw new Error(`${provider} is not an OAuth provider`);
  }
  return config;
}

export type FacebookPageAccess = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
};

/**
 * Page-level data (comments, Messenger, insights) is not reachable with the
 * user access token the standard OAuth code exchange returns — Graph API
 * requires a separate Page Access Token. This does the two extra hops:
 * 1. Exchange the short-lived user token for a long-lived one (~60 days),
 *    which in turn makes Page tokens derived from it long-lived too.
 * 2. Call /me/accounts to list the Pages this user administers and their
 *    Page Access Tokens.
 * Only the first Page returned is used — this app is built for a household
 * syncing a single Page, not a multi-Page manager.
 */
export async function exchangeFacebookPageAccess(
  userAccessToken: string,
): Promise<FacebookPageAccess> {
  const config = configFor("facebook");
  const clientId = providerClientId(config);
  const clientSecret = providerClientSecret(config);
  if (!clientId || !clientSecret) {
    throw new Error("facebook OAuth client is not configured");
  }

  const longLivedUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  longLivedUrl.searchParams.set("client_id", clientId);
  longLivedUrl.searchParams.set("client_secret", clientSecret);
  longLivedUrl.searchParams.set("fb_exchange_token", userAccessToken);
  const longLivedRes = await fetch(longLivedUrl);
  const longLivedJson = (await longLivedRes.json()) as Record<string, unknown>;
  if (!longLivedRes.ok) {
    throw new Error(`Facebook long-lived token exchange failed: ${JSON.stringify(longLivedJson)}`);
  }
  const longLivedToken = longLivedJson.access_token as string;

  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${longLivedToken}`,
  );
  const pagesJson = (await pagesRes.json()) as Record<string, unknown>;
  if (!pagesRes.ok) {
    throw new Error(`Facebook Pages list failed: ${JSON.stringify(pagesJson)}`);
  }
  type Page = { id: string; name: string; access_token: string };
  const pages = (pagesJson.data ?? []) as Page[];
  const page = pages[0];
  if (!page) {
    throw new Error(
      "No Facebook Pages found for this account. Reconnect using an account that is an admin of the Page you want to sync.",
    );
  }
  return { pageId: page.id, pageName: page.name, pageAccessToken: page.access_token };
}
