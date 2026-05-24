import { NextResponse } from "next/server";
import { STREAMER_CHANNELS } from "@/lib/streamers";
import type { YoutubeLiveResponse } from "@/lib/types";
import { attachDebugFields, getChannelLiveStatus } from "@/lib/youtube-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const isDevelopment = process.env.NODE_ENV === "development";

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "YouTube API key is not configured. Set YOUTUBE_API_KEY in .env.local for local development or in Vercel Project Settings → Environment Variables for production.",
      },
      { status: 503 },
    );
  }

  try {
    const results = await Promise.all(
      STREAMER_CHANNELS.map((channel) => getChannelLiveStatus(channel, apiKey)),
    );

    const streamers = results.map(({ streamer, debug }) =>
      attachDebugFields(streamer, debug, isDevelopment),
    );

    const payload: YoutubeLiveResponse = { streamers };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch YouTube live status";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
