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
      x: body.x ?? Math.random() * 200,
      y: body.y ?? Math.random() * 200,
      rotation: body.rotation ?? (Math.random() * 6 - 3),
    },
  });
  return NextResponse.json({ note }, { status: 201 });
}
