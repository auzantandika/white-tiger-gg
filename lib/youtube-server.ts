import type { LiveStreamer, StreamerChannel } from "./types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const REQUEST_CONCURRENCY = 4;
const REQUEST_DELAY_MS = 200;

interface YouTubeChannelResponse {
  items?: Array<{ id: string }>;
  error?: YouTubeApiErrorBody;
}

interface YouTubeSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      thumbnails?: {
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
  error?: YouTubeApiErrorBody;
}

interface YouTubeVideosResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      liveBroadcastContent?: string;
      thumbnails?: {
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
    liveStreamingDetails?: {
      actualStartTime?: string;
      actualEndTime?: string;
    };
  }>;
  error?: YouTubeApiErrorBody;
}

interface YouTubeApiErrorBody {
  code?: number;
  message?: string;
  errors?: Array<{ reason?: string; message?: string }>;
}

export interface StreamerLiveDebug {
  channelHandle: string;
  channelId: string;
  resolvedChannelId: string;
  resolveStatus: string;
  primaryLiveSearchStatus: string;
  fallbackSearchStatus: string;
  videoCheckedCount: number;
  errorMessage?: string;
}

export interface ChannelLiveResult {
  streamer: LiveStreamer;
  debug: StreamerLiveDebug;
}

export interface LiveDetectionOptions {
  enableFallback?: boolean;
  resolveHandles?: boolean;
}

function normalizeHandle(handle: string): string {
  return handle.startsWith("@") ? handle.slice(1) : handle;
}

function buildApiUrl(path: string, params: Record<string, string>, apiKey: string): string {
  const search = new URLSearchParams({ ...params, key: apiKey });
  return `${YOUTUBE_API_BASE}${path}?${search.toString()}`;
}

function parseYouTubeError(body: unknown, httpStatus: number): string {
  const errorBody = body as YouTubeApiErrorBody | undefined;
  const message = errorBody?.message?.trim();

  if (message) {
    return message;
  }

  return `YouTube API request failed with status ${httpStatus}`;
}

export function isQuotaExceededError(message?: string): boolean {
  if (!message) {
    return false;
  }

  const lower = message.toLowerCase();
  return lower.includes("quota exceeded") || lower.includes("exceeded your quota");
}

export function isFallbackEnabled(): boolean {
  return process.env.YOUTUBE_ENABLE_FALLBACK === "true";
}

function thumbnailFromSnippet(snippet?: {
  thumbnails?: {
    medium?: { url?: string };
    default?: { url?: string };
  };
}): string {
  return (
    snippet?.thumbnails?.medium?.url ??
    snippet?.thumbnails?.default?.url ??
    ""
  );
}

function offlineStreamer(channel: StreamerChannel): LiveStreamer {
  return {
    id: channel.id,
    name: channel.name,
    channelUrl: channel.channelUrl,
    status: "OFFLINE",
    videoId: "",
    title: "",
    thumbnail: "",
  };
}

function unknownStreamer(
  channel: StreamerChannel,
  errorMessage?: string,
): LiveStreamer {
  return {
    id: channel.id,
    name: channel.name,
    channelUrl: channel.channelUrl,
    status: "UNKNOWN",
    videoId: "",
    title: "",
    thumbnail: "",
    ...(errorMessage ? { errorMessage } : {}),
  };
}

export function extractChannelIdFromUrl(url: string): string | null {
  const match = url.match(/\/channel\/(UC[\w-]+)/i);
  return match?.[1] ?? null;
}

export function extractHandleFromUrl(url: string): string | null {
  const match = url.match(/\/@([^/?#]+)/);
  if (!match?.[1]) {
    return null;
  }

  return `@${decodeURIComponent(match[1])}`;
}

async function resolveHandleToChannelId(
  handle: string,
  apiKey: string,
): Promise<{ channelId: string | null; status: string; errorMessage?: string }> {
  const forHandle = normalizeHandle(handle);
  const url = buildApiUrl("/channels", { part: "id", forHandle }, apiKey);

  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json()) as YouTubeChannelResponse;

  if (!response.ok) {
    return {
      channelId: null,
      status: "error",
      errorMessage: parseYouTubeError(body.error ?? body, response.status),
    };
  }

  const channelId = body.items?.[0]?.id ?? null;

  if (!channelId) {
    return {
      channelId: null,
      status: "not_found",
      errorMessage: `No YouTube channel found for handle ${handle}`,
    };
  }

  return { channelId, status: "ok" };
}

export interface ResolveStreamerChannelResult {
  channelId: string | null;
  status: string;
  channelHandle: string;
  channelIdField: string;
  errorMessage?: string;
}

export function getStreamerChannelIdOnly(streamer: StreamerChannel): string | null {
  const configuredId = streamer.channelId?.trim();
  if (configuredId) {
    return configuredId;
  }

  return extractChannelIdFromUrl(streamer.channelUrl);
}

export async function resolveStreamerChannel(
  streamer: StreamerChannel,
  apiKey: string,
): Promise<ResolveStreamerChannelResult> {
  const configuredId = streamer.channelId?.trim() ?? "";
  const configuredHandle = streamer.channelHandle?.trim() ?? "";
  const urlChannelId = extractChannelIdFromUrl(streamer.channelUrl) ?? "";
  const urlHandle = extractHandleFromUrl(streamer.channelUrl) ?? "";

  if (configuredId) {
    return {
      channelId: configuredId,
      status: "direct",
      channelHandle: configuredHandle || urlHandle,
      channelIdField: configuredId,
    };
  }

  if (urlChannelId) {
    return {
      channelId: urlChannelId,
      status: "url_channel_id",
      channelHandle: urlHandle,
      channelIdField: urlChannelId,
    };
  }

  if (urlHandle) {
    const resolved = await resolveHandleToChannelId(urlHandle, apiKey);
    return {
      channelId: resolved.channelId,
      status: resolved.channelId ? "url_handle" : resolved.status,
      channelHandle: urlHandle,
      channelIdField: "",
      errorMessage: resolved.errorMessage,
    };
  }

  if (configuredHandle) {
    const resolved = await resolveHandleToChannelId(configuredHandle, apiKey);
    return {
      channelId: resolved.channelId,
      status: resolved.channelId ? "handle" : resolved.status,
      channelHandle: configuredHandle,
      channelIdField: "",
      errorMessage: resolved.errorMessage,
    };
  }

  return {
    channelId: null,
    status: "not_found",
    channelHandle: "",
    channelIdField: "",
    errorMessage: "No channel ID or handle could be extracted from streamer config",
  };
}

async function fetchPrimaryLiveVideo(
  channelId: string,
  apiKey: string,
): Promise<{
  live: { videoId: string; title: string; thumbnail: string } | null;
  status: string;
  errorMessage?: string;
}> {
  const url = buildApiUrl(
    "/search",
    {
      part: "snippet",
      channelId,
      eventType: "live",
      type: "video",
      maxResults: "1",
    },
    apiKey,
  );

  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json()) as YouTubeSearchResponse;

  if (!response.ok) {
    return {
      live: null,
      status: "error",
      errorMessage: parseYouTubeError(body.error ?? body, response.status),
    };
  }

  const item = body.items?.[0];
  const videoId = item?.id?.videoId;

  if (!videoId) {
    return { live: null, status: "offline" };
  }

  return {
    live: {
      videoId,
      title: item.snippet?.title ?? "",
      thumbnail: thumbnailFromSnippet(item.snippet),
    },
    status: "live",
  };
}

function isVideoLive(item: NonNullable<YouTubeVideosResponse["items"]>[number]): boolean {
  if (item.snippet?.liveBroadcastContent === "live") {
    return true;
  }

  const details = item.liveStreamingDetails;
  return Boolean(details?.actualStartTime && !details?.actualEndTime);
}

async function fetchFallbackLiveVideo(
  channelId: string,
  apiKey: string,
): Promise<{
  live: { videoId: string; title: string; thumbnail: string } | null;
  status: string;
  videoCheckedCount: number;
  errorMessage?: string;
}> {
  const searchUrl = buildApiUrl(
    "/search",
    {
      part: "snippet",
      channelId,
      type: "video",
      order: "date",
      maxResults: "5",
    },
    apiKey,
  );

  const searchResponse = await fetch(searchUrl, { cache: "no-store" });
  const searchBody = (await searchResponse.json()) as YouTubeSearchResponse;

  if (!searchResponse.ok) {
    return {
      live: null,
      status: "error",
      videoCheckedCount: 0,
      errorMessage: parseYouTubeError(searchBody.error ?? searchBody, searchResponse.status),
    };
  }

  const videoIds =
    searchBody.items
      ?.map((item) => item.id?.videoId)
      .filter((id): id is string => Boolean(id)) ?? [];

  if (videoIds.length === 0) {
    return { live: null, status: "offline", videoCheckedCount: 0 };
  }

  const videosUrl = buildApiUrl(
    "/videos",
    {
      part: "snippet,liveStreamingDetails",
      id: videoIds.join(","),
    },
    apiKey,
  );

  const videosResponse = await fetch(videosUrl, { cache: "no-store" });
  const videosBody = (await videosResponse.json()) as YouTubeVideosResponse;

  if (!videosResponse.ok) {
    return {
      live: null,
      status: "error",
      videoCheckedCount: videoIds.length,
      errorMessage: parseYouTubeError(videosBody.error ?? videosBody, videosResponse.status),
    };
  }

  for (const item of videosBody.items ?? []) {
    if (isVideoLive(item) && item.id) {
      return {
        live: {
          videoId: item.id,
          title: item.snippet?.title ?? "",
          thumbnail: thumbnailFromSnippet(item.snippet),
        },
        status: "live",
        videoCheckedCount: videoIds.length,
      };
    }
  }

  return { live: null, status: "offline", videoCheckedCount: videoIds.length };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
      if (REQUEST_DELAY_MS > 0) {
        await sleep(REQUEST_DELAY_MS);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => runWorker(),
  );

  await Promise.all(workers);
  return results;
}

export async function getChannelLiveStatus(
  channel: StreamerChannel,
  apiKey: string,
  options: LiveDetectionOptions = {},
): Promise<ChannelLiveResult> {
  const enableFallback = options.enableFallback ?? isFallbackEnabled();
  const resolveHandles = options.resolveHandles ?? true;

  const debug: StreamerLiveDebug = {
    channelHandle: channel.channelHandle ?? extractHandleFromUrl(channel.channelUrl) ?? "",
    channelId: channel.channelId ?? extractChannelIdFromUrl(channel.channelUrl) ?? "",
    resolvedChannelId: "",
    resolveStatus: "pending",
    primaryLiveSearchStatus: "pending",
    fallbackSearchStatus: "skipped",
    videoCheckedCount: 0,
  };

  try {
    let resolvedChannelId: string | null = null;

    if (resolveHandles) {
      const resolved = await resolveStreamerChannel(channel, apiKey);
      debug.resolveStatus = resolved.status;
      debug.resolvedChannelId = resolved.channelId ?? "";
      debug.channelHandle = resolved.channelHandle;
      debug.channelId = resolved.channelIdField || debug.channelId;
      resolvedChannelId = resolved.channelId;

      if (resolved.errorMessage) {
        debug.errorMessage = resolved.errorMessage;
      }
    } else {
      resolvedChannelId = getStreamerChannelIdOnly(channel);
      debug.resolveStatus = resolvedChannelId ? "direct" : "missing_channel_id";
      debug.resolvedChannelId = resolvedChannelId ?? "";
      debug.channelId = resolvedChannelId ?? debug.channelId;

      if (!resolvedChannelId) {
        debug.errorMessage = "Missing channelId";
        debug.primaryLiveSearchStatus = "skipped";
        return {
          streamer: unknownStreamer(channel, "Missing channelId"),
          debug,
        };
      }
    }

    if (!resolvedChannelId) {
      debug.primaryLiveSearchStatus = "skipped";
      if (isQuotaExceededError(debug.errorMessage)) {
        return { streamer: unknownStreamer(channel, debug.errorMessage), debug };
      }
      return { streamer: offlineStreamer(channel), debug };
    }

    const primaryResult = await fetchPrimaryLiveVideo(resolvedChannelId, apiKey);
    debug.primaryLiveSearchStatus = primaryResult.status;

    if (primaryResult.errorMessage) {
      debug.errorMessage = primaryResult.errorMessage;
      if (isQuotaExceededError(primaryResult.errorMessage)) {
        return { streamer: unknownStreamer(channel, primaryResult.errorMessage), debug };
      }
      return { streamer: offlineStreamer(channel), debug };
    }

    if (primaryResult.live) {
      return {
        streamer: {
          id: channel.id,
          name: channel.name,
          channelUrl: channel.channelUrl,
          status: "LIVE",
          videoId: primaryResult.live.videoId,
          title: primaryResult.live.title,
          thumbnail: primaryResult.live.thumbnail,
        },
        debug,
      };
    }

    if (!enableFallback) {
      return { streamer: offlineStreamer(channel), debug };
    }

    const fallbackResult = await fetchFallbackLiveVideo(resolvedChannelId, apiKey);
    debug.fallbackSearchStatus = fallbackResult.status;
    debug.videoCheckedCount = fallbackResult.videoCheckedCount;

    if (fallbackResult.errorMessage) {
      debug.errorMessage = fallbackResult.errorMessage;
      if (isQuotaExceededError(fallbackResult.errorMessage)) {
        return { streamer: unknownStreamer(channel, fallbackResult.errorMessage), debug };
      }
      return { streamer: offlineStreamer(channel), debug };
    }

    if (!fallbackResult.live) {
      return { streamer: offlineStreamer(channel), debug };
    }

    return {
      streamer: {
        id: channel.id,
        name: channel.name,
        channelUrl: channel.channelUrl,
        status: "LIVE",
        videoId: fallbackResult.live.videoId,
        title: fallbackResult.live.title,
        thumbnail: fallbackResult.live.thumbnail,
      },
      debug,
    };
  } catch {
    debug.resolveStatus = debug.resolveStatus === "pending" ? "error" : debug.resolveStatus;
    debug.primaryLiveSearchStatus =
      debug.primaryLiveSearchStatus === "pending" ? "error" : debug.primaryLiveSearchStatus;
    debug.fallbackSearchStatus =
      debug.fallbackSearchStatus === "pending" ? "error" : debug.fallbackSearchStatus;
    debug.errorMessage = "Unexpected error while checking YouTube live status";

    return { streamer: unknownStreamer(channel, debug.errorMessage), debug };
  }
}

export async function getAllChannelsLiveStatus(
  channels: StreamerChannel[],
  apiKey: string,
  options: LiveDetectionOptions = {},
): Promise<ChannelLiveResult[]> {
  return processWithConcurrency(channels, REQUEST_CONCURRENCY, (channel) =>
    getChannelLiveStatus(channel, apiKey, {
      ...options,
      resolveHandles: options.resolveHandles ?? true,
    }),
  );
}

export type LiveStreamerWithDebug = LiveStreamer & Partial<StreamerLiveDebug>;

export function attachDebugFields(
  streamer: LiveStreamer,
  debug: StreamerLiveDebug,
  includeDebug: boolean,
): LiveStreamerWithDebug {
  if (!includeDebug) {
    return streamer;
  }

  return {
    ...streamer,
    channelHandle: debug.channelHandle,
    channelId: debug.channelId,
    resolvedChannelId: debug.resolvedChannelId,
    resolveStatus: debug.resolveStatus,
    primaryLiveSearchStatus: debug.primaryLiveSearchStatus,
    fallbackSearchStatus: debug.fallbackSearchStatus,
    videoCheckedCount: debug.videoCheckedCount,
    ...(debug.errorMessage ? { errorMessage: debug.errorMessage } : {}),
  };
}
