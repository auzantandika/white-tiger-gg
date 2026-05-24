import type { LiveStreamer, YoutubeLiveResponse } from "./types";

export const DEFAULT_SCAN_BATCH_SIZE = 51;

export function isConfirmedLive(streamer: LiveStreamer): boolean {
  return streamer.status === "LIVE" && Boolean(streamer.videoId);
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
  };
}
