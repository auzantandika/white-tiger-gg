import { NextResponse } from "next/server";
import { getCronEnvDebug } from "@/lib/youtube-cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Temporary endpoint for cron env debugging. Remove after auth is verified. */
export async function GET() {
  return NextResponse.json(getCronEnvDebug(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
