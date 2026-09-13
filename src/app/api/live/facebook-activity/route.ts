import { NextResponse } from "next/server";
import { fetchFacebookActivity } from "@/lib/integrations/live";

export async function GET() {
  const activity = await fetchFacebookActivity();
  return NextResponse.json({ activity });
}
