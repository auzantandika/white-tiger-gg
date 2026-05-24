import { NextResponse } from "next/server";
import { STREAMER_CHANNELS } from "@/lib/streamers";
import type { YoutubeLiveResponse } from "@/lib/types";
import {
  getCachedLiveStreamers,
  getMergedStreamers,
  setCachedLiveStreamers,
  setLastResponseAt,
} from "@/lib/youtube-live-cache";
import { runRotatingLiveScan } from "@/lib/youtube-live-scan";
import {
  getLiveCacheControlHeader,
  getScanBatchSize,
} from "@/lib/youtube-config";
import {
  attachDebugFields,
  isFallbackEnabled,
  isQuotaExceededError,
} from "@/lib/youtube-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const isDevelopment = process.env.NODE_ENV === "development";
  const cacheControl = getLiveCacheControlHeader();

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
      {
        enableFallback: isFallbackEnabled(),
        batchSize: getScanBatchSize(),
      },
    );

    const debugById = new Map(
      results.map(({ streamer, debug }) => [streamer.id, debug]),
    );

    const streamers = getMergedStreamers(STREAMER_CHANNELS).map((streamer) => {
      const debug = debugById.get(streamer.id);
      if (isDevelopment && debug) {
        return attachDebugFields(streamer, debug, true);
      }
      return streamer;
    });
    const lastCheckedAt = new Date().toISOString();
    setLastResponseAt(lastCheckedAt);
    setCachedLiveStreamers(streamers);

    const payload: YoutubeLiveResponse = {
      streamers,
      lastCheckedAt,
      scannedCount,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": cacheControl,
        "X-Live-Scan-Count": String(scannedCount),
      },
    });
  } catch (error) {
    const cached = getCachedLiveStreamers();
    if (cached) {
      return NextResponse.json(
        {
          streamers: cached,
          lastCheckedAt: new Date().toISOString(),
        } satisfies YoutubeLiveResponse,
        {
          headers: {
            "Cache-Control": cacheControl,
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
