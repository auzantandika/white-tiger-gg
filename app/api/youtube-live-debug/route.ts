import { NextResponse } from "next/server";
import { STREAMER_CHANNELS } from "@/lib/streamers";
import { getMergedStreamers } from "@/lib/youtube-live-cache";
import { attachDebugFields } from "@/lib/youtube-server";
import { runRotatingLiveScan } from "@/lib/youtube-live-scan";
import { getScanBatchSize } from "@/lib/youtube-config";

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
    const { results, scannedCount } = await runRotatingLiveScan(
      STREAMER_CHANNELS,
      apiKey,
      { batchSize: getScanBatchSize(), resolveHandles: true },
    );

    const debugById = new Map(
      results.map(({ streamer, debug }) => [streamer.id, debug]),
    );

    const streamers = getMergedStreamers(STREAMER_CHANNELS).map((streamer) => {
      const debug = debugById.get(streamer.id);
      return debug ? attachDebugFields(streamer, debug, true) : streamer;
    });

    return NextResponse.json(
      {
        warning:
          "Debug endpoint uses YouTube API quota. Do not refresh repeatedly.",
        scannedCount,
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
