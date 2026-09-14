import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const notes = await db.note.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  const body = await request.json();
  const note = await db.note.create({
    data: {
      text: body.text ?? "",
      color: body.color ?? "yellow",
      // Fractional (0..1) position within the corkboard canvas — same
      // convention as Sticker, so both render on one shared drag surface.
      x: body.x ?? 0.3 + Math.random() * 0.4,
      y: body.y ?? 0.25 + Math.random() * 0.4,
      rotation: body.rotation ?? Math.random() * 6 - 3,
    },
  });
  return NextResponse.json({ note }, { status: 201 });
}
