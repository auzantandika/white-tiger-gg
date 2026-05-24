import { isConfirmedLive } from "@/lib/stream-live-filter";
import type { StreamerChannel } from "./types";
import {
  ensureScanCache,
  getCachedStreamerMap,
  getScanCursor,
  setScanCursor,
  updateCachedStreamers,
} from "./youtube-live-cache";
import { getScanBatchSize } from "./youtube-config";
import {
  runBatchedChannelLiveScan,
  type ChannelLiveResult,
} from "./youtube-server";

export interface ScanBatchSelection {
  toScan: StreamerChannel[];
  nextCursor: number;
  recheckedLiveCount: number;
  livePrioritized: boolean;
  scannedStreamerIds: string[];
  skippedStreamerIds: string[];
  scanBatchSize: number;
}

export interface RotatingLiveScanResult {
  results: ChannelLiveResult[];
  scannedCount: number;
  recheckedLiveCount: number;
  scanBatchSize: number;
  livePrioritized: boolean;
  scannedStreamerIds: string[];
  skippedStreamerIds: string[];
}

export function selectScanBatch(
  channels: StreamerChannel[],
  batchSize: number,
): ScanBatchSelection {
  if (batchSize >= channels.length) {
    ensureScanCache(channels);
    const streamersById = getCachedStreamerMap();
    const recheckedLiveCount = channels.filter((channel) => {
      const cached = streamersById.get(channel.id);
      return cached ? isConfirmedLive(cached) : false;
    }).length;

    return {
      toScan: channels,
      nextCursor: 0,
      recheckedLiveCount,
      livePrioritized: recheckedLiveCount > 0,
      scannedStreamerIds: channels.map((channel) => channel.id),
      skippedStreamerIds: [],
      scanBatchSize: batchSize,
    };
  }

  ensureScanCache(channels);

  const streamersById = getCachedStreamerMap();
  const liveChannels = channels.filter((channel) => {
    const cached = streamersById.get(channel.id);
    return cached ? isConfirmedLive(cached) : false;
  });
  const otherChannels = channels.filter((channel) => {
    const cached = streamersById.get(channel.id);
    return !cached || !isConfirmedLive(cached);
  });

  const toScan: StreamerChannel[] = [];
  const seen = new Set<string>();

  for (const channel of liveChannels) {
    toScan.push(channel);
    seen.add(channel.id);
  }

  const recheckedLiveCount = liveChannels.length;
  const livePrioritized = recheckedLiveCount > 0;

  if (recheckedLiveCount > batchSize) {
    const scannedStreamerIds = toScan.map((channel) => channel.id);
    const skippedStreamerIds = channels
      .filter((channel) => !seen.has(channel.id))
      .map((channel) => channel.id);

    return {
      toScan,
      nextCursor: getScanCursor(),
      recheckedLiveCount,
      livePrioritized,
      scannedStreamerIds,
      skippedStreamerIds,
      scanBatchSize: batchSize,
    };
  }

  let cursor = getScanCursor();
  let offlineAdded = 0;

  while (toScan.length < batchSize && otherChannels.length > 0) {
    const channel = otherChannels[cursor % otherChannels.length];
    cursor += 1;
    offlineAdded += 1;

    if (seen.has(channel.id)) {
      if (offlineAdded >= otherChannels.length) {
        break;
      }
      continue;
    }

    toScan.push(channel);
    seen.add(channel.id);

    if (offlineAdded >= otherChannels.length) {
      break;
    }
  }

  const nextCursor =
    otherChannels.length > 0 ? cursor % otherChannels.length : getScanCursor();
  const scannedStreamerIds = toScan.map((channel) => channel.id);
  const skippedStreamerIds = channels
    .filter((channel) => !seen.has(channel.id))
    .map((channel) => channel.id);

  return {
    toScan,
    nextCursor,
    recheckedLiveCount,
    livePrioritized,
    scannedStreamerIds,
    skippedStreamerIds,
    scanBatchSize: batchSize,
  };
}

export async function runRotatingLiveScan(
  channels: StreamerChannel[],
  apiKey: string,
  options: { batchSize?: number; resolveHandles?: boolean } = {},
): Promise<RotatingLiveScanResult> {
  const batchSize = options.batchSize ?? getScanBatchSize();
  const resolveHandles = options.resolveHandles ?? false;
  const selection = selectScanBatch(channels, batchSize);

  const rawResults = await runBatchedChannelLiveScan(selection.toScan, apiKey, {
    resolveHandles,
  });

  const checkedAt = new Date().toISOString();
  const results = rawResults.map((result) => ({
    streamer: { ...result.streamer, lastCheckedAt: checkedAt },
    debug: result.debug,
  }));

  updateCachedStreamers(results.map(({ streamer }) => streamer));
  setScanCursor(selection.nextCursor);

  return {
    results,
    scannedCount: selection.toScan.length,
    recheckedLiveCount: selection.recheckedLiveCount,
    scanBatchSize: selection.scanBatchSize,
    livePrioritized: selection.livePrioritized,
    scannedStreamerIds: selection.scannedStreamerIds,
    skippedStreamerIds: selection.skippedStreamerIds,
  };
}
