import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

export type BridgeDevice = {
  id: string;
  kind: "light" | "lock" | "climate";
  name: string;
  on?: boolean;
  brightness?: number;
  locked?: boolean;
  currentTemp?: number;
  targetTemp?: number;
  mode?: string;
  error?: string;
};

async function getBridgeCredentials(): Promise<{ baseUrl: string; token: string } | null> {
  const integration = await db.integration.findFirst({ where: { provider: "homebridge", status: "connected" } });
  if (!integration?.credentialUsername || !integration.credentialSecretEnc) return null;
  return { baseUrl: integration.credentialUsername, token: decryptSecret(integration.credentialSecretEnc) };
}

export async function GET() {
  const credentials = await getBridgeCredentials();
  if (!credentials) {
    return NextResponse.json({ devices: [] });
  }

  try {
    const res = await fetch(`${credentials.baseUrl}/status`, {
      headers: { Authorization: `Bearer ${credentials.token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Bridge responded with ${res.status}`);
    const body = (await res.json()) as { devices: BridgeDevice[] };
    return NextResponse.json({ devices: body.devices });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message, devices: [] }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const { deviceId, command } = (await request.json()) as { deviceId?: string; command?: Record<string, unknown> };
  if (!deviceId || !command) {
    return NextResponse.json({ error: "deviceId and command are required" }, { status: 400 });
  }

  const credentials = await getBridgeCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Home Status is not connected" }, { status: 400 });
  }

  try {
    const res = await fetch(`${credentials.baseUrl}/devices/${encodeURIComponent(deviceId)}/command`, {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    if (!res.ok) throw new Error(`Bridge responded with ${res.status}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
