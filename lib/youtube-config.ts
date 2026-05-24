export function getLiveCacheSeconds(): number {
  const parsed = Number.parseInt(process.env.YOUTUBE_LIVE_CACHE_SECONDS ?? "300", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
}

export function getScanBatchSize(): number {
  const parsed = Number.parseInt(process.env.YOUTUBE_SCAN_BATCH_SIZE ?? "47", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 47;
}

export function getLiveCacheControlHeader(): string {
  const seconds = getLiveCacheSeconds();
  return `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`;
}
