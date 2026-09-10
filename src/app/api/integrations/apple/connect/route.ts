import { NextResponse } from "next/server";
import { DAVClient } from "tsdav";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

export async function POST(request: Request) {
  const { appleId, appPassword } = (await request.json()) as {
    appleId?: string;
    appPassword?: string;
  };

  if (!appleId || !appPassword) {
    return NextResponse.json({ error: "Apple ID and app-specific password are required" }, {
      status: 400,
    });
  }

  // Verify the credentials actually work before storing anything.
  try {
    const client = new DAVClient({
      serverUrl: "https://caldav.icloud.com",
      credentials: { username: appleId, password: appPassword },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
    await client.login();
    await client.fetchCalendars();
  } catch (err) {
    return NextResponse.json(
      { error: `Could not connect to iCloud CalDAV: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  await db.integration.upsert({
    where: { provider_externalAccountId: { provider: "apple", externalAccountId: appleId } },
    create: {
      provider: "apple",
      externalAccountId: appleId,
      label: appleId,
      status: "connected",
      credentialUsername: appleId,
      credentialSecretEnc: encryptSecret(appPassword),
    },
    update: {
      status: "connected",
      credentialUsername: appleId,
      credentialSecretEnc: encryptSecret(appPassword),
      lastError: null,
    },
  });

  return NextResponse.json({ ok: true });
}
