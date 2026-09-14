import type { IntegrationProvider } from "@/generated/prisma/enums";

export type OAuthProviderConfig = {
  authType: "oauth";
  id: IntegrationProvider;
  displayName: string;
  description: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  requiresClientSecret?: boolean;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Slack splits bot vs user scopes via a separate query param. */
  userScopeParam?: string;
  extraAuthorizeParams?: Record<string, string>;
};

export type CredentialProviderConfig = {
  authType: "credentials";
  id: IntegrationProvider;
  displayName: string;
  description: string;
  fields: { name: string; label: string; type: "text" | "password"; placeholder?: string }[];
};

/**
 * OAuth must use one stable callback URI. Prefer an explicit APP_URL so
 * operators can register a custom domain. On Vercel, the production project
 * URL is a safe fallback when APP_URL has not been added yet. Never use a
 * request/preview origin here because providers require an exact match.
 */
function appUrl() {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) return `https://${vercelProduction.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export function redirectUriFor(provider: string) {
  return `${appUrl()}/api/integrations/${provider}/callback`;
}

export const PROVIDERS: Record<IntegrationProvider, ProviderConfig> = {
  google: {
    authType: "oauth",
    id: "google",
    displayName: "Google Calendar",
    description: "Upcoming events from your Google Calendar.",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/calendar.events",
      "openid",
      "email",
      "profile",
    ],
    extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
  },
  microsoft: {
    authType: "oauth",
    id: "microsoft",
    displayName: "Microsoft 365",
    description: "Outlook Calendar events and Teams chat activity.",
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
    authorizeUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? "common"}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? "common"}/oauth2/v2.0/token`,
    scopes: [
      "offline_access",
      "User.Read",
      "Calendars.ReadWrite",
      "Chat.Read",
    ],
  },
  slack: {
    authType: "oauth",
    id: "slack",
    displayName: "Slack",
    description: "Recent messages from your Slack workspace.",
    clientIdEnv: "SLACK_CLIENT_ID",
    clientSecretEnv: "SLACK_CLIENT_SECRET",
    authorizeUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: [],
    userScopeParam:
      "channels:history,channels:read,groups:history,groups:read,im:history,im:read,mpim:history,mpim:read,users:read",
  },
  facebook: {
    authType: "oauth",
    id: "facebook",
    displayName: "Facebook Page",
    description: "Comments, Messenger messages, and insights from your Facebook Page.",
    clientIdEnv: "FACEBOOK_CLIENT_ID",
    clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: [
      "public_profile",
      "pages_show_list",
      "pages_read_engagement",
      "pages_read_user_content",
      "pages_messaging",
      "read_insights",
    ],
  },
  spotify: {
    authType: "oauth",
    id: "spotify",
    displayName: "Spotify",
    description: "See what's playing, with album art, on your dashboard.",
    clientIdEnv: "SPOTIFY_CLIENT_ID",
    clientSecretEnv: "",
    requiresClientSecret: false,
    authorizeUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",
    scopes: ["user-read-playback-state", "user-read-currently-playing", "user-read-recently-played"],
  },
  apple: {
    authType: "credentials",
    id: "apple",
    displayName: "Apple Calendar (iCloud)",
    description: "Upcoming events from your iCloud calendars via CalDAV.",
    fields: [
      { name: "appleId", label: "Apple ID", type: "text", placeholder: "you@icloud.com" },
      {
        name: "appPassword",
        label: "App-Specific Password",
        type: "password",
        placeholder: "xxxx-xxxx-xxxx-xxxx",
      },
    ],
  },
};

export type ProviderConfig = OAuthProviderConfig | CredentialProviderConfig;

export function isOAuthProvider(config: ProviderConfig): config is OAuthProviderConfig {
  return config.authType === "oauth";
}

export function providerClientId(config: OAuthProviderConfig): string | undefined {
  return process.env[config.clientIdEnv];
}

export function providerClientSecret(config: OAuthProviderConfig): string | undefined {
  return config.clientSecretEnv ? process.env[config.clientSecretEnv] : undefined;
}

export function isProviderConfigured(config: ProviderConfig): boolean {
  if (config.authType === "credentials") return true;
  if (!providerClientId(config)) return false;
  if (config.requiresClientSecret === false) return true;
  return Boolean(providerClientSecret(config));
}
