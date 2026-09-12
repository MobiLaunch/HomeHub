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

  const requestUrl = new URL(request.url);
  const from = requestUrl.searchParams.get("from") === "setup" ? "setup" : "settings";
  const state = generateState();
  const redirectUri = `${requestUrl.origin}/api/integrations/${provider}/callback`;
  const cookieStore = await cookies();

  cookieStore.set(
    `${OAUTH_STATE_COOKIE_PREFIX}${provider}`,
    JSON.stringify({ state, from, redirectUri }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    },
  );

  const url = buildAuthorizeUrl(config, state, redirectUri);
  return NextResponse.redirect(url);
}
