import { NextResponse } from "next/server";
import { fetchLiveMessages } from "@/lib/integrations/live";

export async function GET() {
  const messages = await fetchLiveMessages();
  return NextResponse.json({ messages });
}
