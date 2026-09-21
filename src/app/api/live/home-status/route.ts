import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

export type MediaNowPlaying = {
  title: string;
  subtitle?: string;
  imageUrl?: string;
};

export type BridgeDevice = {
  id: string;
  kind: "light" | "lock" | "climate" | "speaker" | "tv";
  name: string;
  room?: string;
  on?: boolean;
  brightness?: number;
  locked?: boolean;
  currentTemp?: number;
  targetTemp?: number;
  mode?: string;
  // speaker / tv
  playback?: "playing" | "paused" | "idle";
  volume?: number;
  muted?: boolean;
  nowPlaying?: MediaNowPlaying;
  // tv only
  pairingState?: "unpaired" | "awaiting_code" | "paired";
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
  const { deviceId, command, pair, pairCode } = (await request.json()) as {
    deviceId?: string;
    command?: Record<string, unknown>;
    /** Kicks off Android TV's one-time on-screen PIN pairing. */
    pair?: true;
    /** Submits the PIN shown on the TV. */
    pairCode?: string;
  };
  if (!deviceId || (!command && !pair && !pairCode)) {
    return NextResponse.json({ error: "deviceId and one of command/pair/pairCode are required" }, { status: 400 });
  }

  const credentials = await getBridgeCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Home Status is not connected" }, { status: 400 });
  }

  const id = encodeURIComponent(deviceId);
  const path = pair ? `/devices/${id}/pair` : pairCode ? `/devices/${id}/pair/code` : `/devices/${id}/command`;
  const body = pairCode ? { code: pairCode } : command;

  try {
    const res = await fetch(`${credentials.baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) throw new Error(`Bridge responded with ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
