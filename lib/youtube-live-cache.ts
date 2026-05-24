import type { LiveStreamer } from "./types";

const CACHE_TTL_MS = 120_000;

interface LiveCacheEntry {
  timestamp: number;
  streamers: LiveStreamer[];
}

let liveCache: LiveCacheEntry | null = null;

export function getCachedLiveStreamers(): LiveStreamer[] | null {
  if (!liveCache) {
    return null;
  }

  if (Date.now() - liveCache.timestamp > CACHE_TTL_MS) {
    return null;
  }

  return liveCache.streamers;
}

export function setCachedLiveStreamers(streamers: LiveStreamer[]): void {
  liveCache = {
    timestamp: Date.now(),
    streamers,
  };
}

export const LIVE_CACHE_TTL_MS = CACHE_TTL_MS;
