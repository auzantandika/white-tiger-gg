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

interface YouTubeApiErrorBody {
  code?: number;
  message?: string;
  errors?: Array<{ reason?: string; message?: string }>;
}

export interface StreamerLiveDebug {
  channelHandle: string;
  resolvedChannelId: string;
  resolveStatus: string;
  liveSearchStatus: string;
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

async function resolveChannelId(
  channel: StreamerChannel,
  apiKey: string,
): Promise<{ channelId: string | null; status: string; errorMessage?: string }> {
  const directId = channel.channelId?.trim();
  if (directId) {
    return { channelId: directId, status: "direct" };
  }

  const handle = channel.channelHandle?.trim();
  if (!handle) {
    return {
      channelId: null,
      status: "not_found",
      errorMessage: "No channel handle or channel ID configured",
    };
  }

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

async function fetchLiveVideo(
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
      thumbnail:
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url ??
        "",
    },
    status: "live",
  };
}

export async function getChannelLiveStatus(
  channel: StreamerChannel,
  apiKey: string,
): Promise<ChannelLiveResult> {
  const debug: StreamerLiveDebug = {
    channelHandle: channel.channelHandle ?? channel.channelId ?? "",
    resolvedChannelId: "",
    resolveStatus: "pending",
    liveSearchStatus: "pending",
  };

  try {
    const resolved = await resolveChannelId(channel, apiKey);
    debug.resolveStatus = resolved.status;
    debug.resolvedChannelId = resolved.channelId ?? "";

    if (resolved.errorMessage) {
      debug.errorMessage = resolved.errorMessage;
    }

    if (!resolved.channelId) {
      debug.liveSearchStatus = "skipped";
      return { streamer: offlineStreamer(channel), debug };
    }

    const liveResult = await fetchLiveVideo(resolved.channelId, apiKey);
    debug.liveSearchStatus = liveResult.status;

    if (liveResult.errorMessage) {
      debug.errorMessage = liveResult.errorMessage;
      return { streamer: offlineStreamer(channel), debug };
    }

    if (!liveResult.live) {
      return { streamer: offlineStreamer(channel), debug };
    }

    return {
      streamer: {
        id: channel.id,
        name: channel.name,
        channelUrl: channel.channelUrl,
        status: "LIVE",
        videoId: liveResult.live.videoId,
        title: liveResult.live.title,
        thumbnail: liveResult.live.thumbnail,
      },
      debug,
    };
  } catch {
    debug.resolveStatus = debug.resolveStatus === "pending" ? "error" : debug.resolveStatus;
    debug.liveSearchStatus =
      debug.liveSearchStatus === "pending" ? "error" : debug.liveSearchStatus;
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
    resolvedChannelId: debug.resolvedChannelId,
    resolveStatus: debug.resolveStatus,
    liveSearchStatus: debug.liveSearchStatus,
    ...(debug.errorMessage ? { errorMessage: debug.errorMessage } : {}),
  };
}
