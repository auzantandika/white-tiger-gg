import { getLiveStreamers } from "@/lib/stream-live-filter";
import type { LiveStreamer, StreamerChannel } from "./types";

const SNAPSHOT_KEY = "white-tiger-gg:youtube-live:snapshot";

export interface CachedLiveData {
  streamers: LiveStreamer[];
  liveCount: number;
  totalChannels: number;
  scannedCount: number;
  lastCheckedAt: string;
  nextScanAt: string;
  scannedAt: string;
  scanBatchSize: number;
  recheckedLiveCount: number;
  livePrioritized: boolean;
  scannedStreamerIds: string[];
  skippedStreamerIds: string[];
  scanCursor: number;
  quotaUsedEstimate?: number;
  dailyQuotaBudget?: number;
  quotaSafetyLimit?: number;
}

/** @deprecated Use CachedLiveData */
export type YoutubeLiveScanSnapshot = CachedLiveData;

interface YoutubeLiveStore {
  read(): Promise<CachedLiveData | null>;
  write(data: CachedLiveData): Promise<void>;
  provider: string;
}

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

export function buildStreamerMapFromSnapshot(
  channels: StreamerChannel[],
  snapshot: CachedLiveData | null,
): Map<string, LiveStreamer> {
  const streamersById = new Map<string, LiveStreamer>();

  if (snapshot) {
    for (const streamer of snapshot.streamers) {
      streamersById.set(streamer.id, streamer);
    }
  }

  for (const channel of channels) {
    if (!streamersById.has(channel.id)) {
      streamersById.set(channel.id, createUnknownStreamer(channel));
    }
  }

  return streamersById;
}

export function snapshotStreamersFromMap(
  channels: StreamerChannel[],
  streamersById: Map<string, LiveStreamer>,
): LiveStreamer[] {
  return channels.map(
    (channel) => streamersById.get(channel.id) ?? createUnknownStreamer(channel),
  );
}

export function countConfirmedLive(streamers: LiveStreamer[]): number {
  return getLiveStreamers(streamers).length;
}

function getRedisRestConfig(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL?.trim() ??
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ??
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return { url: url.replace(/\/$/, ""), token };
}

class RedisRestYoutubeLiveStore implements YoutubeLiveStore {
  readonly provider = "redis-rest";

  constructor(
    private readonly config: { url: string; token: string },
  ) {}

  async read(): Promise<CachedLiveData | null> {
    const response = await fetch(
      `${this.config.url}/get/${encodeURIComponent(SNAPSHOT_KEY)}`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to read YouTube live cache (${response.status})`);
    }

    const body = (await response.json()) as { result?: string | null };
    if (!body.result) {
      return null;
    }

    return JSON.parse(body.result) as CachedLiveData;
  }

  async write(data: CachedLiveData): Promise<void> {
    const response = await fetch(
      `${this.config.url}/set/${encodeURIComponent(SNAPSHOT_KEY)}`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to write YouTube live cache (${response.status})`);
    }
  }
}

class MemoryYoutubeLiveStore implements YoutubeLiveStore {
  readonly provider = "memory";

  private snapshot: CachedLiveData | null = null;

  async read(): Promise<CachedLiveData | null> {
    return this.snapshot;
  }

  async write(data: CachedLiveData): Promise<void> {
    this.snapshot = data;
  }
}

let storeInstance: YoutubeLiveStore | null = null;

function getYoutubeLiveStore(): YoutubeLiveStore {
  if (storeInstance) {
    return storeInstance;
  }

  const redisConfig = getRedisRestConfig();
  if (redisConfig) {
    storeInstance = new RedisRestYoutubeLiveStore(redisConfig);
    return storeInstance;
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[youtube-live-store] No KV/Upstash Redis configured — using in-memory store. Configure KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*) for persistent cache.",
    );
  }

  storeInstance = new MemoryYoutubeLiveStore();
  return storeInstance;
}

export function getStoreProviderLabel(): string {
  const url =
    process.env.KV_REST_API_URL?.trim() ??
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  return url ? "redis-rest" : "memory";
}

export async function getCachedLiveData(): Promise<CachedLiveData | null> {
  return getYoutubeLiveStore().read();
}

export async function setCachedLiveData(data: CachedLiveData): Promise<void> {
  await getYoutubeLiveStore().write(data);
}

export async function getCachedLiveDataAge(): Promise<number | null> {
  const data = await getCachedLiveData();
  if (!data?.scannedAt) {
    return null;
  }

  const scannedAtMs = Date.parse(data.scannedAt);
  if (!Number.isFinite(scannedAtMs)) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - scannedAtMs) / 1000));
}

/** @deprecated Use getCachedLiveData */
export async function readYoutubeLiveSnapshot(): Promise<CachedLiveData | null> {
  return getCachedLiveData();
}

/** @deprecated Use setCachedLiveData */
export async function writeYoutubeLiveSnapshot(data: CachedLiveData): Promise<void> {
  await setCachedLiveData(data);
}

export async function getYoutubeLiveStoreProvider(): Promise<string> {
  return getYoutubeLiveStore().provider;
}
