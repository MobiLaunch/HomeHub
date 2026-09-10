import { NextResponse } from "next/server";
import { fetchLiveNotifications } from "@/lib/integrations/live";

export async function GET() {
  const notifications = await fetchLiveNotifications();
  return NextResponse.json({ notifications });
}
