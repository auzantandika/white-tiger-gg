import { NextResponse } from "next/server";
import { STREAMER_CHANNELS } from "@/lib/streamers";
import {
  attachDebugFields,
  getAllChannelsLiveStatus,
  isFallbackEnabled,
} from "@/lib/youtube-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Temporary debug endpoint for inspecting YouTube live detection in production.
 * Remove this route or protect it (auth, IP allowlist, env flag) once live
 * detection issues are resolved.
 */
export async function GET() {
  const apiKey = process.env.YOUTUBE_API_KEY;

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
    const results = await getAllChannelsLiveStatus(STREAMER_CHANNELS, apiKey, {
      enableFallback: isFallbackEnabled(),
      resolveHandles: true,
    });

    const streamers = results.map(({ streamer, debug }) =>
      attachDebugFields(streamer, debug, true),
    );

    return NextResponse.json(
      {
        warning:
          "Debug endpoint uses more quota. Do not refresh repeatedly.",
        streamers,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch YouTube live status";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
