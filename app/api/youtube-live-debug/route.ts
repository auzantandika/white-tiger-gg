import { NextResponse } from "next/server";
import { readYoutubeLiveResponse } from "@/lib/youtube-live-read";
import {
  fetchVpsHealthSummary,
  getLiveDataServiceUrl,
} from "@/lib/vps-live-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Debug endpoint — reads live data from VPS when configured, otherwise local cache.
 * YouTube scans run on the VPS service (or via /api/cron/scan-youtube-live when VPS is not set).
 */
export async function GET() {
  try {
    const payload = await readYoutubeLiveResponse();
    const vpsUrl = getLiveDataServiceUrl();
    const vpsHealth = vpsUrl ? await fetchVpsHealthSummary().catch(() => null) : null;

    return NextResponse.json(
      {
        warning: vpsUrl
          ? "Debug endpoint reads live data from the VPS service. Scans run on VPS."
          : "Debug endpoint reads cached data only. Scans run via /api/cron/scan-youtube-live.",
        liveDataServiceUrl: vpsUrl,
        vpsHealth,
        storeProvider: payload.storeProvider ?? (vpsUrl ? "vps-file" : "none"),
        source: payload.source,
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
        cacheAgeSeconds: payload.cacheAgeSeconds,
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
        : "Failed to read YouTube live status";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
