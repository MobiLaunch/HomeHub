import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PROVIDERS, isOAuthProvider } from "@/lib/integrations/registry";
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

  const from = new URL(request.url).searchParams.get("from") === "setup" ? "setup" : "settings";
  const state = generateState();
  const cookieStore = await cookies();

  // Keep the OAuth state cookie scoped to the canonical application origin.
  // The callback URI sent to the provider is also derived from APP_URL, so
  // Google sees exactly the same URI that is configured in its OAuth client.
  cookieStore.set(`${OAUTH_STATE_COOKIE_PREFIX}${provider}`, `${state}:${from}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildAuthorizeUrl(config, state));
}
