import { STREAMER_CHANNELS } from "@/lib/streamers";
import { getLiveCacheSeconds } from "@/lib/youtube-config";
import {
  buildStreamerMapFromSnapshot,
  readYoutubeLiveSnapshot,
  snapshotStreamersFromMap,
} from "@/lib/youtube-live-store";
import type { LiveStreamer, StreamerChannel, YoutubeLiveResponse } from "@/lib/types";

import { UNSCANNED_LIVE_MESSAGE } from "@/lib/constants";

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

export function buildUnscannedLiveResponse(
  channels: StreamerChannel[] = STREAMER_CHANNELS,
): YoutubeLiveResponse {
  return {
    streamers: channels.map(createUnknownStreamer),
    totalChannels: channels.length,
    lastCheckedAt: null,
    scannedCount: 0,
    scanBatchSize: 0,
    recheckedLiveCount: 0,
    livePrioritized: false,
    scannedStreamerIds: [],
    skippedStreamerIds: channels.map((channel) => channel.id),
    message: UNSCANNED_LIVE_MESSAGE,
    cacheStale: true,
    cacheSeconds: getLiveCacheSeconds(),
    source: "cache",
  };
}

export function isSnapshotStale(
  scannedAt: string | null | undefined,
  cacheSeconds: number,
): boolean {
  if (!scannedAt) {
    return true;
  }

  const scannedAtMs = Date.parse(scannedAt);
  if (!Number.isFinite(scannedAtMs)) {
    return true;
  }

  return Date.now() - scannedAtMs > cacheSeconds * 1000;
}

export async function readCachedYoutubeLiveResponse(): Promise<YoutubeLiveResponse> {
  const cacheSeconds = getLiveCacheSeconds();
  const snapshot = await readYoutubeLiveSnapshot();

  if (!snapshot?.scannedAt) {
    return buildUnscannedLiveResponse();
  }

  const streamers = snapshotStreamersFromMap(
    STREAMER_CHANNELS,
    buildStreamerMapFromSnapshot(STREAMER_CHANNELS, snapshot),
  );

  return {
    streamers,
    totalChannels: snapshot.totalChannels,
    lastCheckedAt: snapshot.lastCheckedAt,
    scannedCount: snapshot.scannedCount,
    scanBatchSize: snapshot.scanBatchSize,
    recheckedLiveCount: snapshot.recheckedLiveCount,
    livePrioritized: snapshot.livePrioritized,
    scannedStreamerIds: snapshot.scannedStreamerIds,
    skippedStreamerIds: snapshot.skippedStreamerIds,
    cacheStale: isSnapshotStale(snapshot.scannedAt, cacheSeconds),
    cacheSeconds,
    source: "cache",
    storeProvider: getStoreProviderLabel(),
    ...(snapshot.quotaUsedEstimate !== undefined
      ? { quotaUsedEstimate: snapshot.quotaUsedEstimate }
      : {}),
  };
}

function getStoreProviderLabel(): string {
  const url =
    process.env.KV_REST_API_URL?.trim() ??
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  return url ? "redis-rest" : "memory";
}
