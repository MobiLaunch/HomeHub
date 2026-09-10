import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const household = await db.household.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  return NextResponse.json({ household });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const household = await db.household.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      name: body.name,
      timezone: body.timezone,
      accentColor: body.accentColor,
      setupCompleted: body.setupCompleted,
    },
    update: {
      name: body.name,
      timezone: body.timezone,
      accentColor: body.accentColor,
      setupCompleted: body.setupCompleted,
    },
  });
  return NextResponse.json({ household });
}
