import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Temporary endpoint for cron env debugging. Remove after auth is verified. */
export async function GET() {
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";

  return NextResponse.json(
    {
      hasCronSecret: cronSecret.length > 0,
      cronSecretLength: cronSecret.length,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      currentCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
