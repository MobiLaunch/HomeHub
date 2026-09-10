import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_TILES = [
  { tileType: "calendar", position: 0, size: "lg" },
  { tileType: "messages", position: 1, size: "md" },
  { tileType: "notifications", position: 2, size: "md" },
  { tileType: "notes", position: 3, size: "md" },
  { tileType: "stickers", position: 4, size: "lg" },
];

export async function GET() {
  const existing = await db.tilePreference.findMany({ orderBy: { position: "asc" } });
  if (existing.length === 0) {
    await db.tilePreference.createMany({ data: DEFAULT_TILES });
    const seeded = await db.tilePreference.findMany({ orderBy: { position: "asc" } });
    return NextResponse.json({ tiles: seeded });
  }
  return NextResponse.json({ tiles: existing });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { tileType: string; enabled?: boolean; position?: number };
  const tile = await db.tilePreference.update({
    where: { tileType: body.tileType },
    data: { enabled: body.enabled, position: body.position },
  });
  return NextResponse.json({ tile });
}
