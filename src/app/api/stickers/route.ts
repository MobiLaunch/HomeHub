import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const stickers = await db.sticker.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ stickers });
}

export async function POST(request: Request) {
  const body = await request.json();
  const sticker = await db.sticker.create({
    data: {
      emoji: body.emoji ?? "⭐",
      x: body.x ?? Math.random() * 200,
      y: body.y ?? Math.random() * 200,
      rotation: body.rotation ?? (Math.random() * 20 - 10),
    },
  });
  return NextResponse.json({ sticker }, { status: 201 });
}
