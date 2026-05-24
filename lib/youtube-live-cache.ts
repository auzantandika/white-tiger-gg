import type { LiveStreamer, StreamerChannel } from "./types";

interface ScanCacheState {
  scanCursor: number;
  streamersById: Map<string, LiveStreamer>;
  lastResponseAt: string | null;
}

let scanCache: ScanCacheState = {
  scanCursor: 0,
  streamersById: new Map(),
  lastResponseAt: null,
};

function createUnknownStreamer(channel: StreamerChannel): LiveStreamer {
  return {
    id: channel.id,
    name: channel.name,
    channelUrl: channel.channelUrl,
    status: "UNKNOWN",
    videoId: "",
    title: "",
    thumbnail: "",
  };
}

export function ensureScanCache(channels: StreamerChannel[]): ScanCacheState {
  for (const channel of channels) {
    if (!scanCache.streamersById.has(channel.id)) {
      scanCache.streamersById.set(channel.id, createUnknownStreamer(channel));
    }
  }

  return scanCache;
}

export function getScanCursor(): number {
  return scanCache.scanCursor;
}

export function setScanCursor(cursor: number): void {
  scanCache.scanCursor = cursor;
}

export function getCachedStreamerMap(): Map<string, LiveStreamer> {
  return scanCache.streamersById;
}

export function updateCachedStreamers(updates: LiveStreamer[]): void {
  for (const streamer of updates) {
    scanCache.streamersById.set(streamer.id, streamer);
  }
}

export function getMergedStreamers(channels: StreamerChannel[]): LiveStreamer[] {
  ensureScanCache(channels);
  return channels.map(
    (channel) => scanCache.streamersById.get(channel.id) ?? createUnknownStreamer(channel),
  );
}

export function getLastResponseAt(): string | null {
  return scanCache.lastResponseAt;
}

export function setLastResponseAt(timestamp: string): void {
  scanCache.lastResponseAt = timestamp;
}

export function getCachedLiveStreamers(): LiveStreamer[] | null {
  if (scanCache.streamersById.size === 0 || !scanCache.lastResponseAt) {
    return null;
  }

  return [...scanCache.streamersById.values()];
}

export function setCachedLiveStreamers(streamers: LiveStreamer[]): void {
  for (const streamer of streamers) {
    scanCache.streamersById.set(streamer.id, streamer);
  }
  scanCache.lastResponseAt = new Date().toISOString();
}
