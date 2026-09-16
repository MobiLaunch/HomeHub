import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

export async function POST(request: Request) {
  const { baseUrl, token } = (await request.json()) as {
    baseUrl?: string;
    token?: string;
  };

  if (!baseUrl || !token) {
    return NextResponse.json({ error: "Bridge URL and bearer token are required" }, { status: 400 });
  }

  const normalizedUrl = baseUrl.replace(/\/$/, "");

  // Verify the bridge actually answers before storing anything.
  try {
    const res = await fetch(`${normalizedUrl}/status`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(res.status === 401 ? "Bearer token was rejected" : `Bridge responded with ${res.status}`);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach the HomeHub Bridge plugin at ${normalizedUrl}: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  await db.integration.upsert({
    where: { provider_externalAccountId: { provider: "homebridge", externalAccountId: normalizedUrl } },
    create: {
      provider: "homebridge",
      externalAccountId: normalizedUrl,
      label: normalizedUrl,
      status: "connected",
      credentialUsername: normalizedUrl,
      credentialSecretEnc: encryptSecret(token),
    },
    update: {
      status: "connected",
      credentialUsername: normalizedUrl,
      credentialSecretEnc: encryptSecret(token),
      lastError: null,
    },
  });

  return NextResponse.json({ ok: true });
}
