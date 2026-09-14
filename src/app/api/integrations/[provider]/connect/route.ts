import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PROVIDERS, isOAuthProvider, isProviderConfigured } from "@/lib/integrations/registry";
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
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const origin = forwardedProto && forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : requestUrl.origin;
  const redirectUri = `${origin}/api/integrations/${provider}/callback`;
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
