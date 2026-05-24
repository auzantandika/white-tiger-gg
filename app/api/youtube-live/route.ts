import { NextResponse } from "next/server";
import { readYoutubeLiveResponse } from "@/lib/youtube-live-read";
import { getLiveCacheControlHeader } from "@/lib/youtube-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cacheControl = getLiveCacheControlHeader();

  try {
    const payload = await readYoutubeLiveResponse();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": cacheControl,
        "X-Live-Data-Source": payload.source ?? "cache",
        "X-Live-Scan-Count": String(payload.scannedCount ?? 0),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to read YouTube live status";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
