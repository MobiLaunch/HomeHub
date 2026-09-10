import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PROVIDERS, isProviderConfigured } from "@/lib/integrations/registry";
import type { IntegrationProvider } from "@/generated/prisma/enums";

export async function GET() {
  const integrations = await db.integration.findMany({
    orderBy: { createdAt: "asc" },
  });

  const providers = (Object.keys(PROVIDERS) as IntegrationProvider[]).map((id) => {
    const config = PROVIDERS[id];
    const accounts = integrations
      .filter((i) => i.provider === id)
      .map((i) => ({
        id: i.id,
        label: i.label,
        status: i.status,
        lastSyncedAt: i.lastSyncedAt,
        lastError: i.lastError,
      }));
    return {
      id,
      displayName: config.displayName,
      description: config.description,
      authType: config.authType,
      configured: isProviderConfigured(config),
      accounts,
    };
  });

  return NextResponse.json({ providers });
}
