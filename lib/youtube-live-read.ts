import { UNSCANNED_LIVE_MESSAGE } from "@/lib/constants";
import { STREAMER_CHANNELS } from "@/lib/streamers";
import { getLiveCacheSeconds } from "@/lib/youtube-config";
import {
  buildStreamerMapFromSnapshot,
  getCachedLiveData,
  getCachedLiveDataAge,
  getStoreProviderLabel,
  snapshotStreamersFromMap,
} from "@/lib/youtube-live-store";
import type { LiveStreamer, StreamerChannel, YoutubeLiveResponse } from "@/lib/types";

function createUnknownStreamer(channel: StreamerChannel): LiveStreamer {
  return {
    id: channel.id,
    name: channel.name,
    channelUrl: channel.channelUrl,
    status: "UNKNOWN",
    videoId: "",
    title: "",
    thumbnail: "",
    errorMessage: UNSCANNED_LIVE_MESSAGE,
  };
}

export function buildUnscannedLiveResponse(
  channels: StreamerChannel[] = STREAMER_CHANNELS,
): YoutubeLiveResponse {
  const cacheSeconds = getLiveCacheSeconds();

  return {
    streamers: channels.map(createUnknownStreamer),
    liveCount: 0,
    totalChannels: channels.length,
    lastCheckedAt: null,
    nextScanAt: null,
    scannedCount: 0,
    scanBatchSize: 0,
    recheckedLiveCount: 0,
    livePrioritized: false,
    scannedStreamerIds: [],
    skippedStreamerIds: channels.map((channel) => channel.id),
    message: UNSCANNED_LIVE_MESSAGE,
    cacheStale: true,
    cacheSeconds,
    cacheAgeSeconds: null,
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
  const snapshot = await getCachedLiveData();
  const cacheAgeSeconds = await getCachedLiveDataAge();

  if (!snapshot?.scannedAt) {
    return buildUnscannedLiveResponse();
  }

  const streamers = snapshotStreamersFromMap(
    STREAMER_CHANNELS,
    buildStreamerMapFromSnapshot(STREAMER_CHANNELS, snapshot),
  );

  return {
    streamers,
    liveCount: snapshot.liveCount,
    totalChannels: snapshot.totalChannels,
    lastCheckedAt: snapshot.lastCheckedAt,
    nextScanAt: snapshot.nextScanAt,
    scannedCount: snapshot.scannedCount,
    scanBatchSize: snapshot.scanBatchSize,
    recheckedLiveCount: snapshot.recheckedLiveCount,
    livePrioritized: snapshot.livePrioritized,
    scannedStreamerIds: snapshot.scannedStreamerIds,
    skippedStreamerIds: snapshot.skippedStreamerIds,
    cacheStale: isSnapshotStale(snapshot.scannedAt, cacheSeconds),
    cacheSeconds,
    cacheAgeSeconds,
    source: "cache",
    storeProvider: getStoreProviderLabel(),
    ...(snapshot.quotaUsedEstimate !== undefined
      ? { quotaUsedEstimate: snapshot.quotaUsedEstimate }
      : {}),
    ...(snapshot.dailyQuotaBudget !== undefined
      ? { dailyQuotaBudget: snapshot.dailyQuotaBudget }
      : {}),
    ...(snapshot.quotaSafetyLimit !== undefined
      ? { quotaSafetyLimit: snapshot.quotaSafetyLimit }
      : {}),
  };
}
