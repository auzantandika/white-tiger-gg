import type { LiveStreamer, StreamerChannel } from "./types";

const SNAPSHOT_KEY = "white-tiger-gg:youtube-live:snapshot";

export interface YoutubeLiveScanSnapshot {
  streamers: LiveStreamer[];
  lastCheckedAt: string | null;
  scannedAt: string | null;
  scannedCount: number;
  totalChannels: number;
  scanBatchSize: number;
  recheckedLiveCount: number;
  livePrioritized: boolean;
  scannedStreamerIds: string[];
  skippedStreamerIds: string[];
  scanCursor: number;
  quotaUsedEstimate?: number;
}

export interface YoutubeLiveStore {
  getSnapshot(): Promise<YoutubeLiveScanSnapshot | null>;
  setSnapshot(snapshot: YoutubeLiveScanSnapshot): Promise<void>;
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
  snapshot: YoutubeLiveScanSnapshot | null,
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

  async getSnapshot(): Promise<YoutubeLiveScanSnapshot | null> {
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
      throw new Error(`Failed to read YouTube live snapshot (${response.status})`);
    }

    const body = (await response.json()) as { result?: string | null };
    if (!body.result) {
      return null;
    }

    return JSON.parse(body.result) as YoutubeLiveScanSnapshot;
  }

  async setSnapshot(snapshot: YoutubeLiveScanSnapshot): Promise<void> {
    const response = await fetch(
      `${this.config.url}/set/${encodeURIComponent(SNAPSHOT_KEY)}`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(snapshot),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to write YouTube live snapshot (${response.status})`);
    }
  }
}

class MemoryYoutubeLiveStore implements YoutubeLiveStore {
  readonly provider = "memory";

  private snapshot: YoutubeLiveScanSnapshot | null = null;

  async getSnapshot(): Promise<YoutubeLiveScanSnapshot | null> {
    return this.snapshot;
  }

  async setSnapshot(snapshot: YoutubeLiveScanSnapshot): Promise<void> {
    this.snapshot = snapshot;
  }
}

let storeInstance: YoutubeLiveStore | null = null;

export function getYoutubeLiveStore(): YoutubeLiveStore {
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

export async function readYoutubeLiveSnapshot(): Promise<YoutubeLiveScanSnapshot | null> {
  return getYoutubeLiveStore().getSnapshot();
}

export async function writeYoutubeLiveSnapshot(
  snapshot: YoutubeLiveScanSnapshot,
): Promise<void> {
  await getYoutubeLiveStore().setSnapshot(snapshot);
}
