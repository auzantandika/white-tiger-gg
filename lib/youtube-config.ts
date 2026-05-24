export function getLiveCacheSeconds(): number {
  const parsed = Number.parseInt(process.env.YOUTUBE_LIVE_CACHE_SECONDS ?? "600", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 600;
}

export function getScanBatchSize(): number {
  const parsed = Number.parseInt(process.env.YOUTUBE_SCAN_BATCH_SIZE ?? "51", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 51;
}

export function getDailyQuotaBudget(): number {
  const parsed = Number.parseInt(process.env.YOUTUBE_DAILY_QUOTA_BUDGET ?? "8000", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
}

export function getQuotaSafetyLimit(): number {
  const parsed = Number.parseInt(process.env.YOUTUBE_QUOTA_SAFETY_LIMIT ?? "7500", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7500;
}

export function getLiveCacheControlHeader(source?: "cache" | "vps"): string {
  if (source === "vps") {
    return "no-store";
  }

  const seconds = getLiveCacheSeconds();
  return `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`;
}

export function getCronSchedule(): string {
  return process.env.YOUTUBE_CRON_SCHEDULE?.trim() || "*/10 * * * *";
}
