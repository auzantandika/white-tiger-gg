import { NextResponse } from "next/server";
import { STREAMER_CHANNELS } from "@/lib/streamers";
import type { YoutubeLiveResponse } from "@/lib/types";
import {
  getCachedLiveStreamers,
  setCachedLiveStreamers,
} from "@/lib/youtube-live-cache";
import {
  attachDebugFields,
  getAllChannelsLiveStatus,
  isFallbackEnabled,
  isQuotaExceededError,
} from "@/lib/youtube-server";

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

  const cached = getCachedLiveStreamers();
  if (cached) {
    return NextResponse.json(
      { streamers: cached },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=240",
          "X-Live-Cache": "hit",
        },
      },
    );
  }

  try {
    const results = await getAllChannelsLiveStatus(STREAMER_CHANNELS, apiKey, {
      enableFallback: isFallbackEnabled(),
    });

    const streamers = results.map(({ streamer, debug }) =>
      attachDebugFields(streamer, debug, isDevelopment),
    );

    setCachedLiveStreamers(streamers);

    const payload: YoutubeLiveResponse = { streamers };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=240",
      },
    });
  } catch (error) {
    const cached = getCachedLiveStreamers();
    if (cached) {
      return NextResponse.json(
        { streamers: cached },
        {
          headers: {
            "Cache-Control": "public, s-maxage=120, stale-while-revalidate=240",
            "X-Live-Cache": "hit",
          },
        },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch YouTube live status";

    const status = isQuotaExceededError(message) ? 429 : 502;

    return NextResponse.json({ error: message }, { status });
  }
}
