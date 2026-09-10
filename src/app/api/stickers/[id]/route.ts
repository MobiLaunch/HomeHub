import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const sticker = await db.sticker.update({
    where: { id },
    data: { x: body.x, y: body.y, rotation: body.rotation, scale: body.scale },
  });
  return NextResponse.json({ sticker });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.sticker.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
