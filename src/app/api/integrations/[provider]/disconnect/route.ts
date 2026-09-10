import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const { id } = (await request.json()) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
  }
  await db.integration.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
