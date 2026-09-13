import type { IntegrationProvider } from "@/generated/prisma/enums";

export type OAuthProviderConfig = {
  authType: "oauth";
  id: IntegrationProvider;
  displayName: string;
  description: string;
  clientIdEnv: string;
  clientSecretEnv: string;
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
 * OAuth must use one stable callback URI. APP_URL is the canonical public
 * origin configured for the deployment; using the incoming request origin
 * can produce a redirect_uri_mismatch when the user enters through a Vercel
 * preview/custom alias that is not registered with Google.
 */
function appUrl() {
  const value = process.env.APP_URL?.trim();
  if (!value) return "http://localhost:3000";
  return value.replace(/\/$/, "");
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
      "https://www.googleapis.com/auth/calendar.readonly",
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
      "Calendars.Read",
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
    // Page-level permissions. All five are available in Development Mode to
    // the app's own admins/developers/testers without App Review — which is
    // sufficient for a single household syncing its own Page.
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
    clientSecretEnv: "SPOTIFY_CLIENT_SECRET",
    authorizeUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",
    scopes: ["user-read-currently-playing", "user-read-playback-state", "user-read-recently-played"],
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
  return process.env[config.clientSecretEnv];
}

export function isProviderConfigured(config: ProviderConfig): boolean {
  if (config.authType === "credentials") return true;
  return Boolean(providerClientId(config) && providerClientSecret(config));
}
