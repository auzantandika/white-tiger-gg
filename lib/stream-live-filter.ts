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

export interface NormalizedYoutubeLiveResponse {
  streamers: LiveStreamer[];
  lastCheckedAt: string | null;
  scannedCount: number;
  scanBatchSize: number;
  totalChannels: number;
  recheckedLiveCount: number;
  livePrioritized: boolean;
  scannedStreamerIds: string[];
  skippedStreamerIds: string[];
}

export function normalizeYoutubeLiveResponse(
  data: YoutubeLiveResponse,
): NormalizedYoutubeLiveResponse {
  const streamers = Array.isArray(data.streamers) ? data.streamers : [];

  return {
    streamers,
    lastCheckedAt: data.lastCheckedAt ?? null,
    scannedCount: data.scannedCount ?? 0,
    scanBatchSize: data.scanBatchSize ?? DEFAULT_SCAN_BATCH_SIZE,
    totalChannels: data.totalChannels ?? streamers.length,
    recheckedLiveCount: data.recheckedLiveCount ?? 0,
    livePrioritized: data.livePrioritized ?? false,
    scannedStreamerIds: Array.isArray(data.scannedStreamerIds)
      ? data.scannedStreamerIds
      : [],
    skippedStreamerIds: Array.isArray(data.skippedStreamerIds)
      ? data.skippedStreamerIds
      : [],
  };
}
