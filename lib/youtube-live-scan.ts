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
  getChannelLiveStatus,
  processWithConcurrency,
  type ChannelLiveResult,
} from "./youtube-server";

const SCAN_CONCURRENCY = 4;

export function selectScanBatch(
  channels: StreamerChannel[],
  batchSize: number,
): { toScan: StreamerChannel[]; nextCursor: number } {
  if (batchSize >= channels.length) {
    return { toScan: channels, nextCursor: 0 };
  }

  ensureScanCache(channels);

  const streamersById = getCachedStreamerMap();
  const liveChannels = channels.filter(
    (channel) => streamersById.get(channel.id)?.status === "LIVE",
  );
  const otherChannels = channels.filter(
    (channel) => streamersById.get(channel.id)?.status !== "LIVE",
  );

  const toScan: StreamerChannel[] = [];
  const seen = new Set<string>();

  for (const channel of liveChannels) {
    if (toScan.length >= batchSize) {
      break;
    }
    toScan.push(channel);
    seen.add(channel.id);
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

  return { toScan, nextCursor };
}

export async function runRotatingLiveScan(
  channels: StreamerChannel[],
  apiKey: string,
  options: { batchSize?: number; resolveHandles?: boolean } = {},
): Promise<{ results: ChannelLiveResult[]; scannedCount: number }> {
  const batchSize = options.batchSize ?? getScanBatchSize();
  const resolveHandles = options.resolveHandles ?? false;
  const { toScan, nextCursor } = selectScanBatch(channels, batchSize);

  const rawResults = await processWithConcurrency(toScan, SCAN_CONCURRENCY, (channel) =>
    getChannelLiveStatus(channel, apiKey, {
      resolveHandles,
    }),
  );

  const checkedAt = new Date().toISOString();
  const results = rawResults.map((result) => ({
    streamer: { ...result.streamer, lastCheckedAt: checkedAt },
    debug: result.debug,
  }));

  updateCachedStreamers(results.map(({ streamer }) => streamer));
  setScanCursor(nextCursor);

  return { results, scannedCount: toScan.length };
}
