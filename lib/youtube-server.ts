import type { LiveStreamer, StreamerChannel } from "./types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

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

  const response = await fetch(url, { next: { revalidate: 60 } });
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

  const response = await fetch(url, { next: { revalidate: 60 } });
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

  const searchResponse = await fetch(searchUrl, { next: { revalidate: 60 } });
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

  const videosResponse = await fetch(videosUrl, { next: { revalidate: 60 } });
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

export async function getChannelLiveStatus(
  channel: StreamerChannel,
  apiKey: string,
): Promise<ChannelLiveResult> {
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
    const resolved = await resolveStreamerChannel(channel, apiKey);
    debug.resolveStatus = resolved.status;
    debug.resolvedChannelId = resolved.channelId ?? "";
    debug.channelHandle = resolved.channelHandle;
    debug.channelId = resolved.channelIdField || debug.channelId;

    if (resolved.errorMessage) {
      debug.errorMessage = resolved.errorMessage;
    }

    if (!resolved.channelId) {
      debug.primaryLiveSearchStatus = "skipped";
      return { streamer: offlineStreamer(channel), debug };
    }

    const primaryResult = await fetchPrimaryLiveVideo(resolved.channelId, apiKey);
    debug.primaryLiveSearchStatus = primaryResult.status;

    if (primaryResult.errorMessage) {
      debug.errorMessage = primaryResult.errorMessage;
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

    const fallbackResult = await fetchFallbackLiveVideo(resolved.channelId, apiKey);
    debug.fallbackSearchStatus = fallbackResult.status;
    debug.videoCheckedCount = fallbackResult.videoCheckedCount;

    if (fallbackResult.errorMessage) {
      debug.errorMessage = fallbackResult.errorMessage;
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

    return { streamer: offlineStreamer(channel), debug };
  }
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
