import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const note = await db.note.update({
    where: { id },
    data: {
      text: body.text,
      color: body.color,
      x: body.x,
      y: body.y,
      rotation: body.rotation,
      pinned: body.pinned,
    },
  });
  return NextResponse.json({ note });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.note.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
