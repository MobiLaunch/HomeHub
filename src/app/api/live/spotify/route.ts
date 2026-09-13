import { NextResponse } from "next/server";
import { fetchSpotifyNowPlaying } from "@/lib/integrations/live";

export async function GET() {
  const nowPlaying = await fetchSpotifyNowPlaying();
  return NextResponse.json({ nowPlaying });
}
