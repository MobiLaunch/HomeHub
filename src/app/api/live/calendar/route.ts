import { NextResponse } from "next/server";
import { fetchCalendarEvents } from "@/lib/integrations/live";

export async function GET() {
  const events = await fetchCalendarEvents();
  return NextResponse.json({ events });
}
