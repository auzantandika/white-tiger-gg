import { NextResponse } from "next/server";
import { STREAMER_CHANNELS } from "@/lib/streamers";
import { verifyCronSecret } from "@/lib/youtube-cron-auth";
import { getScanBatchSize } from "@/lib/youtube-config";
import { runRotatingLiveScan } from "@/lib/youtube-live-scan";
import { isQuotaExceededError } from "@/lib/youtube-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "YouTube API key is not configured. Set YOUTUBE_API_KEY in Vercel Project Settings.",
      },
      { status: 503 },
    );
  }

  try {
    const scan = await runRotatingLiveScan(STREAMER_CHANNELS, apiKey, {
      batchSize: getScanBatchSize(),
    });

    return NextResponse.json(
      {
        ok: true,
        scannedCount: scan.scannedCount,
        liveCount: scan.snapshot.liveCount,
        totalChannels: scan.snapshot.totalChannels,
        lastCheckedAt: scan.snapshot.lastCheckedAt,
        nextScanAt: scan.snapshot.nextScanAt,
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
        : "Failed to scan YouTube live status";

    const status = isQuotaExceededError(message) ? 429 : 502;

    return NextResponse.json({ error: message }, { status });
  }
}
