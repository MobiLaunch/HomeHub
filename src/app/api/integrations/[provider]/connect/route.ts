import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  PROVIDERS,
  isOAuthProvider,
  isProviderConfigured,
  redirectUriFor,
} from "@/lib/integrations/registry";
import { buildAuthorizeUrl, generateState, OAUTH_STATE_COOKIE_PREFIX } from "@/lib/integrations/oauth";
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

  const requestUrl = new URL(request.url);
  const from = requestUrl.searchParams.get("from") === "setup" ? "setup" : "settings";

  // Provider credentials belong to the HomeHub deployment, not to the person
  // using it. Never expose environment-variable names or secret fields in the
  // customer-facing settings UI.
  if (!isProviderConfigured(config)) {
    const destination = new URL(from === "setup" ? "/setup" : "/settings", requestUrl.origin);
    destination.searchParams.set("error", `${config.displayName} is not enabled on this HomeHub deployment yet.`);
    return NextResponse.redirect(destination);
  }

  const state = generateState();

  // OAuth providers (especially Google) require the redirect_uri in the
  // authorize request to exactly match an allow-listed URI. Do not derive it
  // from the incoming Host header: proxies, preview domains and custom aliases
  // can otherwise send a URI that the provider rejects. APP_URL is the
  // deployment's canonical public origin and is the value operators register
  // with each provider.
  const redirectUri = redirectUriFor(provider);
  const cookieStore = await cookies();

  cookieStore.set(`${OAUTH_STATE_COOKIE_PREFIX}${provider}`, JSON.stringify({ state, from, redirectUri }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildAuthorizeUrl(config, state, redirectUri));
}
