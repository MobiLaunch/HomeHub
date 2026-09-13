import { NextResponse } from "next/server";
import { fetchFacebookInsights } from "@/lib/integrations/live";

export async function GET() {
  const insights = await fetchFacebookInsights();
  return NextResponse.json({ insights });
}
