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
  /** Whether the token endpoint expects the client secret in the body (most do). */
};

export type CredentialProviderConfig = {
  authType: "credentials";
  id: IntegrationProvider;
  displayName: string;
  description: string;
  fields: { name: string; label: string; type: "text" | "password"; placeholder?: string }[];
};

export type ProviderConfig = OAuthProviderConfig | CredentialProviderConfig;

function appUrl() {
  return process.env.APP_URL ?? "http://localhost:3000";
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
    displayName: "Facebook",
    description: "Birthday reminders and profile notifications.",
    clientIdEnv: "FACEBOOK_CLIENT_ID",
    clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: ["public_profile", "user_birthday"],
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
