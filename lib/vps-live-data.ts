import { STREAMER_CHANNELS } from "@/lib/streamers";
import type { LiveStreamer, YoutubeLiveResponse } from "@/lib/types";
import {
  buildUnscannedLiveResponse,
  isSnapshotStale,
} from "@/lib/youtube-live-read";
import { getLiveCacheSeconds } from "@/lib/youtube-config";

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

export function getLiveDataServiceUrl(): string | null {
  const url = process.env.LIVE_DATA_SERVICE_URL?.trim();
  if (!url) {
    return null;
  }

  return url.replace(/\/$/, "");
}

function getFetchTimeoutMs(): number {
  const parsed = Number.parseInt(
    process.env.LIVE_DATA_FETCH_TIMEOUT_MS ?? String(DEFAULT_FETCH_TIMEOUT_MS),
    10,
  );

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_FETCH_TIMEOUT_MS;
}

function normalizeStreamersFromVps(streamers: LiveStreamer[]): LiveStreamer[] {
  const streamersById = new Map(streamers.map((streamer) => [streamer.id, streamer]));

  return STREAMER_CHANNELS.map(
    (channel) => streamersById.get(channel.id) ?? {
      id: channel.id,
      name: channel.name,
      channelUrl: channel.channelUrl,
      status: "UNKNOWN" as const,
      videoId: "",
      title: "",
      thumbnail: "",
      errorMessage: "Streamer missing from VPS live data response.",
    },
  );
}

function normalizeVpsLiveResponse(body: YoutubeLiveResponse): YoutubeLiveResponse {
  const cacheSeconds = getLiveCacheSeconds();
  const streamers = normalizeStreamersFromVps(
    Array.isArray(body.streamers) ? body.streamers : [],
  );
  const lastCheckedAt = body.lastCheckedAt ?? null;
  const scannedAtMs = lastCheckedAt ? Date.parse(lastCheckedAt) : Number.NaN;
  const cacheAgeSeconds = Number.isFinite(scannedAtMs)
    ? Math.max(0, Math.floor((Date.now() - scannedAtMs) / 1000))
    : (body.cacheAgeSeconds ?? null);

  return {
    streamers,
    liveCount: body.liveCount ?? 0,
    totalChannels: body.totalChannels ?? STREAMER_CHANNELS.length,
    lastCheckedAt,
    nextScanAt: body.nextScanAt ?? null,
    scannedCount: body.scannedCount ?? 0,
    scanBatchSize: body.scanBatchSize ?? 0,
    recheckedLiveCount: body.recheckedLiveCount ?? 0,
    livePrioritized: body.livePrioritized ?? false,
    scannedStreamerIds: Array.isArray(body.scannedStreamerIds)
      ? body.scannedStreamerIds
      : [],
    skippedStreamerIds: Array.isArray(body.skippedStreamerIds)
      ? body.skippedStreamerIds
      : [],
    message: body.message,
    cacheStale:
      body.cacheStale ??
      isSnapshotStale(lastCheckedAt, cacheSeconds),
    cacheSeconds: body.cacheSeconds ?? cacheSeconds,
    cacheAgeSeconds,
    source: "vps",
    storeProvider: body.storeProvider ?? "vps-file",
  };
}

export async function fetchVpsLiveDataResponse(): Promise<YoutubeLiveResponse> {
  const baseUrl = getLiveDataServiceUrl();

  if (!baseUrl) {
    throw new Error("LIVE_DATA_SERVICE_URL is not configured");
  }

  const response = await fetch(`${baseUrl}/live-data`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(getFetchTimeoutMs()),
  });

  if (!response.ok) {
    throw new Error(
      `VPS live data request failed with status ${response.status}`,
    );
  }

  const body = (await response.json()) as YoutubeLiveResponse;

  if (!Array.isArray(body.streamers) || body.streamers.length === 0) {
    if (!body.lastCheckedAt) {
      return buildUnscannedLiveResponse();
    }
  }

  return normalizeVpsLiveResponse(body);
}

export async function fetchVpsHealthSummary(): Promise<Record<string, unknown>> {
  const baseUrl = getLiveDataServiceUrl();

  if (!baseUrl) {
    throw new Error("LIVE_DATA_SERVICE_URL is not configured");
  }

  const response = await fetch(`${baseUrl}/health`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(getFetchTimeoutMs()),
  });

  if (!response.ok) {
    throw new Error(`VPS health request failed with status ${response.status}`);
  }

  return (await response.json()) as Record<string, unknown>;
}
