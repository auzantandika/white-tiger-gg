import { NextResponse } from "next/server";
import { readCachedYoutubeLiveResponse } from "@/lib/youtube-live-read";
import { getCachedLiveData, getCachedLiveDataAge } from "@/lib/youtube-live-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Debug endpoint — reads cached scan data only (no YouTube API calls).
 * Trigger scans via /api/cron/scan-youtube-live.
 */
export async function GET() {
  try {
    const snapshot = await getCachedLiveData();
    const cacheAgeSeconds = await getCachedLiveDataAge();
    const payload = await readCachedYoutubeLiveResponse();

    return NextResponse.json(
      {
        warning:
          "Debug endpoint reads cached data only. Scans run via /api/cron/scan-youtube-live.",
        storeProvider: snapshot ? payload.storeProvider : "none",
        liveCount: payload.liveCount,
        scannedCount: payload.scannedCount,
        recheckedLiveCount: payload.recheckedLiveCount,
        scanBatchSize: payload.scanBatchSize,
        livePrioritized: payload.livePrioritized,
        scannedStreamerIds: payload.scannedStreamerIds,
        skippedStreamerIds: payload.skippedStreamerIds,
        lastCheckedAt: payload.lastCheckedAt,
        nextScanAt: payload.nextScanAt,
        cacheStale: payload.cacheStale,
        cacheAgeSeconds,
        scanCursor: snapshot?.scanCursor ?? 0,
        dailyQuotaBudget: snapshot?.dailyQuotaBudget,
        quotaSafetyLimit: snapshot?.quotaSafetyLimit,
        streamers: payload.streamers,
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
        : "Failed to read cached YouTube live status";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
