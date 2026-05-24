import type { LiveStreamer, YoutubeLiveResponse } from "./types";

export const DEFAULT_SCAN_BATCH_SIZE = 51;

export function hasChannelOwnershipMatch(streamer: LiveStreamer): boolean {
  if (streamer.channelOwnershipMatch === false) {
    return false;
  }

  if (streamer.detectedVideoChannelId && streamer.expectedChannelId) {
    return streamer.detectedVideoChannelId === streamer.expectedChannelId;
  }

  return true;
}

export function isConfirmedLive(streamer: LiveStreamer): boolean {
  return (
    streamer.status === "LIVE" &&
    Boolean(streamer.videoId) &&
    hasChannelOwnershipMatch(streamer)
  );
}

export function getLiveStreamers(streamers: LiveStreamer[]): LiveStreamer[] {
  return streamers.filter(isConfirmedLive);
}

export function getLiveStreamerIds(streamers: LiveStreamer[]): string[] {
  return getLiveStreamers(streamers).map((streamer) => streamer.id);
}

export function mergeStreamersPreservingLive(
  previous: LiveStreamer[],
  incoming: LiveStreamer[],
): LiveStreamer[] {
  if (previous.length === 0) {
    return incoming;
  }

  const previousById = new Map(previous.map((streamer) => [streamer.id, streamer]));

  return incoming.map((incomingStreamer) => {
    const previousStreamer = previousById.get(incomingStreamer.id);

    if (!previousStreamer || !isConfirmedLive(previousStreamer)) {
      return incomingStreamer;
    }

    if (isConfirmedLive(incomingStreamer)) {
      return incomingStreamer;
    }

    // Only preserve LIVE on real API errors (quota/network) — not on OFFLINE,
    // which now means the scanner actively confirmed no live stream.
    if (incomingStreamer.status === "UNKNOWN") {
      return {
        ...previousStreamer,
        lastCheckedAt:
          incomingStreamer.lastCheckedAt ?? previousStreamer.lastCheckedAt,
      };
    }

    return incomingStreamer;
  });
}

export interface NormalizedYoutubeLiveResponse {
  streamers: LiveStreamer[];
  lastCheckedAt: string | null;
  nextScanAt: string | null;
  scannedCount: number;
  scanBatchSize: number;
  totalChannels: number;
  liveCount: number;
  recheckedLiveCount: number;
  livePrioritized: boolean;
  scannedStreamerIds: string[];
  skippedStreamerIds: string[];
  message: string | null;
  cacheStale: boolean;
  cacheSeconds: number;
  cacheAgeSeconds: number | null;
}

export function normalizeYoutubeLiveResponse(
  data: YoutubeLiveResponse,
): NormalizedYoutubeLiveResponse {
  const streamers = Array.isArray(data.streamers) ? data.streamers : [];

  return {
    streamers,
    lastCheckedAt: data.lastCheckedAt ?? null,
    nextScanAt: data.nextScanAt ?? null,
    scannedCount: data.scannedCount ?? 0,
    scanBatchSize: data.scanBatchSize ?? DEFAULT_SCAN_BATCH_SIZE,
    totalChannels: data.totalChannels ?? streamers.length,
    liveCount: data.liveCount ?? getLiveStreamers(streamers).length,
    recheckedLiveCount: data.recheckedLiveCount ?? 0,
    livePrioritized: data.livePrioritized ?? false,
    scannedStreamerIds: Array.isArray(data.scannedStreamerIds)
      ? data.scannedStreamerIds
      : [],
    skippedStreamerIds: Array.isArray(data.skippedStreamerIds)
      ? data.skippedStreamerIds
      : [],
    message: data.message ?? null,
    cacheStale: data.cacheStale ?? false,
    cacheSeconds: data.cacheSeconds ?? 600,
    cacheAgeSeconds: data.cacheAgeSeconds ?? null,
  };
}
