import { NextResponse } from "next/server";
import { fetchSpotifyNowPlaying } from "@/lib/integrations/spotify-live";

export async function GET() {
  try {
    const nowPlaying = await fetchSpotifyNowPlaying();
    return NextResponse.json({ nowPlaying });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message, nowPlaying: [] },
      { status: 502 },
    );
  }
}
