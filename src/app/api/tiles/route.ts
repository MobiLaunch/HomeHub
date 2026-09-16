import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_TILES = [
  { tileType: "calendar", position: 0, size: "lg" },
  { tileType: "messages", position: 1, size: "md" },
  { tileType: "notifications", position: 2, size: "md" },
  { tileType: "corkboard", position: 3, size: "lg" },
  { tileType: "facebook_insights", position: 5, size: "md" },
  { tileType: "spotify", position: 6, size: "md" },
];

export async function GET() {
  const existing = await db.tilePreference.findMany({ orderBy: { position: "asc" } });
  const missing = DEFAULT_TILES.filter(
    (def) => !existing.some((tile) => tile.tileType === def.tileType),
  );
  if (missing.length > 0) {
    // skipDuplicates guards against a concurrent request (e.g. React's
    // double-invoked effects in dev) seeding the same missing tileType
    // first and hitting the table's unique constraint here instead.
    await db.tilePreference.createMany({ data: missing, skipDuplicates: true });
    const withDefaults = await db.tilePreference.findMany({ orderBy: { position: "asc" } });
    return NextResponse.json({ tiles: withDefaults });
  }
  return NextResponse.json({ tiles: existing });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    tileType: string;
    enabled?: boolean;
    position?: number;
    size?: string;
  };
  const tile = await db.tilePreference.update({
    where: { tileType: body.tileType },
    data: { enabled: body.enabled, position: body.position, size: body.size },
  });
  return NextResponse.json({ tile });
}

/**
 * Persists a full drag-reorder in one go: `order` is every tileType in its
 * new top-to-bottom position, so this recomputes position 0..n rather than
 * requiring the client to figure out individual position deltas.
 */
export async function PUT(request: Request) {
  const body = (await request.json()) as { order: string[] };
  await db.$transaction(
    body.order.map((tileType, position) =>
      db.tilePreference.update({ where: { tileType }, data: { position } }),
    ),
  );
  return NextResponse.json({ ok: true });
}
