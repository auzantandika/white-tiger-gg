import type { LiveStreamer, StreamerChannel } from "./types";
import {
  extractVideoIdsFromLivePage,
  fetchChannelLivePageHtml,
} from "./youtube-live-page";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const REQUEST_CONCURRENCY = 4;
const REQUEST_DELAY_MS = 150;
const UPLOADS_PLAYLIST_MAX_RESULTS = "10";

interface YouTubeChannelResponse {
  items?: Array<{ id: string }>;
  error?: YouTubeApiErrorBody;
}

interface YouTubePlaylistItemsResponse {
  items?: Array<{
    contentDetails?: { videoId?: string };
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
  livePageStatus: string;
  livePageVideoId: string;
  livePageVerifyStatus: string;
  uploadsPlaylistId: string;
  playlistItemsStatus: string;
  videosListStatus: string;
  videoCheckedCount: number;
  finalStatus: string;
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

interface VerifiedLiveVideo {
  videoId: string;
  title: string;
  thumbnail: string;
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
    return normalizeYouTubeErrorMessage(message);
  }

  return `YouTube API request failed with status ${httpStatus}`;
}

export function normalizeYouTubeErrorMessage(message: string): string {
  return message.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export function isQuotaExceededError(message?: string): boolean {
  if (!message) {
    return false;
  }

  const lower = normalizeYouTubeErrorMessage(message).toLowerCase();
  return (
    lower.includes("quota exceeded") ||
    lower.includes("exceeded your quota") ||
    (lower.includes("quota") && lower.includes("exceeded"))
  );
}

export function isFallbackEnabled(): boolean {
  return process.env.YOUTUBE_ENABLE_FALLBACK === "true";
}

export function getUploadsPlaylistId(channelId: string): string | null {
  if (!channelId.startsWith("UC")) {
    return null;
  }

  return `UU${channelId.slice(2)}`;
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

function liveStreamer(
  channel: StreamerChannel,
  live: VerifiedLiveVideo,
): LiveStreamer {
  return {
    id: channel.id,
    name: channel.name,
    channelUrl: channel.channelUrl,
    status: "LIVE",
    videoId: live.videoId,
    title: live.title,
    thumbnail: live.thumbnail,
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

function isVideoLive(item: NonNullable<YouTubeVideosResponse["items"]>[number]): boolean {
  if (item.snippet?.liveBroadcastContent === "live") {
    return true;
  }

  const details = item.liveStreamingDetails;
  return Boolean(details?.actualStartTime && !details?.actualEndTime);
}

const VIDEOS_LIST_BATCH_SIZE = 50;

function verifiedLiveFromItem(
  item: NonNullable<YouTubeVideosResponse["items"]>[number],
): VerifiedLiveVideo | null {
  if (!item.id || !isVideoLive(item)) {
    return null;
  }

  return {
    videoId: item.id,
    title: item.snippet?.title ?? "",
    thumbnail: thumbnailFromSnippet(item.snippet),
  };
}

export async function batchVerifyVideosById(
  videoIds: string[],
  apiKey: string,
): Promise<{
  liveByVideoId: Map<string, VerifiedLiveVideo>;
  verifyStatus: string;
  errorMessage?: string;
}> {
  const uniqueIds = [...new Set(videoIds.filter(Boolean))];
  const liveByVideoId = new Map<string, VerifiedLiveVideo>();

  if (uniqueIds.length === 0) {
    return { liveByVideoId, verifyStatus: "skipped" };
  }

  for (let index = 0; index < uniqueIds.length; index += VIDEOS_LIST_BATCH_SIZE) {
    const batchIds = uniqueIds.slice(index, index + VIDEOS_LIST_BATCH_SIZE);
    const videosUrl = buildApiUrl(
      "/videos",
      {
        part: "snippet,liveStreamingDetails",
        id: batchIds.join(","),
      },
      apiKey,
    );

    const videosResponse = await fetch(videosUrl, { cache: "no-store" });
    const videosBody = (await videosResponse.json()) as YouTubeVideosResponse;

    if (!videosResponse.ok) {
      return {
        liveByVideoId,
        verifyStatus: "error",
        errorMessage: parseYouTubeError(videosBody.error ?? videosBody, videosResponse.status),
      };
    }

    for (const item of videosBody.items ?? []) {
      const live = verifiedLiveFromItem(item);
      if (live) {
        liveByVideoId.set(live.videoId, live);
      }
    }
  }

  return {
    liveByVideoId,
    verifyStatus: liveByVideoId.size > 0 ? "live" : "not_live",
  };
}

async function verifyVideosById(
  videoIds: string[],
  apiKey: string,
): Promise<{
  live: VerifiedLiveVideo | null;
  verifyStatus: string;
  errorMessage?: string;
}> {
  if (videoIds.length === 0) {
    return { live: null, verifyStatus: "skipped" };
  }

  const batch = await batchVerifyVideosById(videoIds, apiKey);

  if (batch.errorMessage) {
    return {
      live: null,
      verifyStatus: "error",
      errorMessage: batch.errorMessage,
    };
  }

  for (const videoId of videoIds) {
    const live = batch.liveByVideoId.get(videoId);
    if (live) {
      return { live, verifyStatus: "live" };
    }
  }

  return { live: null, verifyStatus: "not_live" };
}

export interface LivePageProbe {
  livePageStatus: string;
  livePageVideoId: string;
  candidateIds: string[];
  errorMessage?: string;
}

export async function probeChannelLivePageById(
  channelId: string,
): Promise<LivePageProbe> {
  const page = await fetchChannelLivePageHtml(channelId);

  if (page.errorMessage) {
    return {
      livePageStatus: "error",
      livePageVideoId: "",
      candidateIds: [],
      errorMessage: page.errorMessage,
    };
  }

  const candidateIds = extractVideoIdsFromLivePage(page.html, page.finalUrl);

  if (candidateIds.length === 0) {
    return {
      livePageStatus: "no_video",
      livePageVideoId: "",
      candidateIds: [],
    };
  }

  return {
    livePageStatus: "video_found",
    livePageVideoId: candidateIds[0] ?? "",
    candidateIds,
  };
}

export async function fetchUploadsPlaylistVideoIds(
  channelId: string,
  apiKey: string,
): Promise<{
  uploadsPlaylistId: string | null;
  videoIds: string[];
  playlistItemsStatus: string;
  errorMessage?: string;
}> {
  const uploadsPlaylistId = getUploadsPlaylistId(channelId);

  if (!uploadsPlaylistId) {
    return {
      uploadsPlaylistId: null,
      videoIds: [],
      playlistItemsStatus: "invalid_channel_id",
      errorMessage: "Invalid channel ID format",
    };
  }

  const playlistUrl = buildApiUrl(
    "/playlistItems",
    {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: UPLOADS_PLAYLIST_MAX_RESULTS,
    },
    apiKey,
  );

  const playlistResponse = await fetch(playlistUrl, { cache: "no-store" });
  const playlistBody = (await playlistResponse.json()) as YouTubePlaylistItemsResponse;

  if (!playlistResponse.ok) {
    return {
      uploadsPlaylistId,
      videoIds: [],
      playlistItemsStatus: "error",
      errorMessage: parseYouTubeError(playlistBody.error ?? playlistBody, playlistResponse.status),
    };
  }

  const videoIds =
    playlistBody.items
      ?.map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id)) ?? [];

  return {
    uploadsPlaylistId,
    videoIds,
    playlistItemsStatus: videoIds.length > 0 ? "ok" : "empty",
  };
}

function findLiveForCandidates(
  candidateIds: string[],
  liveByVideoId: Map<string, VerifiedLiveVideo>,
): VerifiedLiveVideo | null {
  for (const videoId of candidateIds) {
    const live = liveByVideoId.get(videoId);
    if (live) {
      return live;
    }
  }

  return null;
}

async function fetchLiveViaChannelLivePage(
  channelId: string,
  apiKey: string,
): Promise<{
  live: VerifiedLiveVideo | null;
  livePageStatus: string;
  livePageVideoId: string;
  livePageVerifyStatus: string;
  errorMessage?: string;
}> {
  const page = await fetchChannelLivePageHtml(channelId);

  if (page.errorMessage) {
    return {
      live: null,
      livePageStatus: "error",
      livePageVideoId: "",
      livePageVerifyStatus: "skipped",
      errorMessage: page.errorMessage,
    };
  }

  const candidateIds = extractVideoIdsFromLivePage(page.html, page.finalUrl);

  if (candidateIds.length === 0) {
    return {
      live: null,
      livePageStatus: "no_video",
      livePageVideoId: "",
      livePageVerifyStatus: "skipped",
    };
  }

  const verification = await verifyVideosById(candidateIds, apiKey);

  if (verification.errorMessage && isQuotaExceededError(verification.errorMessage)) {
    return {
      live: null,
      livePageStatus: "video_found",
      livePageVideoId: candidateIds[0] ?? "",
      livePageVerifyStatus: verification.verifyStatus,
      errorMessage: verification.errorMessage,
    };
  }

  if (verification.live) {
    return {
      live: verification.live,
      livePageStatus: "live_verified",
      livePageVideoId: verification.live.videoId,
      livePageVerifyStatus: verification.verifyStatus,
    };
  }

  return {
    live: null,
    livePageStatus: "video_found",
    livePageVideoId: candidateIds[0] ?? "",
    livePageVerifyStatus: verification.verifyStatus,
    errorMessage: verification.errorMessage,
  };
}

async function fetchLiveViaUploadsPlaylist(
  channelId: string,
  apiKey: string,
): Promise<{
  live: VerifiedLiveVideo | null;
  uploadsPlaylistId: string | null;
  playlistItemsStatus: string;
  videosListStatus: string;
  videoCheckedCount: number;
  errorMessage?: string;
}> {
  const uploadsPlaylistId = getUploadsPlaylistId(channelId);

  if (!uploadsPlaylistId) {
    return {
      live: null,
      uploadsPlaylistId: null,
      playlistItemsStatus: "invalid_channel_id",
      videosListStatus: "skipped",
      videoCheckedCount: 0,
      errorMessage: "Invalid channel ID format",
    };
  }

  const playlistUrl = buildApiUrl(
    "/playlistItems",
    {
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: UPLOADS_PLAYLIST_MAX_RESULTS,
    },
    apiKey,
  );

  const playlistResponse = await fetch(playlistUrl, { cache: "no-store" });
  const playlistBody = (await playlistResponse.json()) as YouTubePlaylistItemsResponse;

  if (!playlistResponse.ok) {
    return {
      live: null,
      uploadsPlaylistId,
      playlistItemsStatus: "error",
      videosListStatus: "skipped",
      videoCheckedCount: 0,
      errorMessage: parseYouTubeError(playlistBody.error ?? playlistBody, playlistResponse.status),
    };
  }

  const videoIds =
    playlistBody.items
      ?.map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id)) ?? [];

  if (videoIds.length === 0) {
    return {
      live: null,
      uploadsPlaylistId,
      playlistItemsStatus: "empty",
      videosListStatus: "skipped",
      videoCheckedCount: 0,
    };
  }

  const verification = await verifyVideosById(videoIds, apiKey);

  if (verification.errorMessage) {
    return {
      live: null,
      uploadsPlaylistId,
      playlistItemsStatus: "ok",
      videosListStatus: "error",
      videoCheckedCount: videoIds.length,
      errorMessage: verification.errorMessage,
    };
  }

  if (verification.live) {
    return {
      live: verification.live,
      uploadsPlaylistId,
      playlistItemsStatus: "ok",
      videosListStatus: "live",
      videoCheckedCount: videoIds.length,
    };
  }

  return {
    live: null,
    uploadsPlaylistId,
    playlistItemsStatus: "ok",
    videosListStatus: "offline",
    videoCheckedCount: videoIds.length,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processWithConcurrency<T, R>(
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

function createInitialDebug(channel: StreamerChannel): StreamerLiveDebug {
  return {
    channelHandle: channel.channelHandle ?? extractHandleFromUrl(channel.channelUrl) ?? "",
    channelId: channel.channelId ?? extractChannelIdFromUrl(channel.channelUrl) ?? "",
    resolvedChannelId: "",
    resolveStatus: "pending",
    livePageStatus: "pending",
    livePageVideoId: "",
    livePageVerifyStatus: "skipped",
    uploadsPlaylistId: "",
    playlistItemsStatus: "pending",
    videosListStatus: "skipped",
    videoCheckedCount: 0,
    finalStatus: "pending",
  };
}

export async function getChannelLiveStatus(
  channel: StreamerChannel,
  apiKey: string,
  options: LiveDetectionOptions = {},
): Promise<ChannelLiveResult> {
  const resolveHandles = options.resolveHandles ?? true;
  const debug = createInitialDebug(channel);

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
        debug.livePageStatus = "skipped";
        debug.playlistItemsStatus = "skipped";
        debug.finalStatus = "UNKNOWN";
        return {
          streamer: unknownStreamer(channel, "Missing channelId"),
          debug,
        };
      }
    }

    if (!resolvedChannelId) {
      debug.livePageStatus = "skipped";
      debug.playlistItemsStatus = "skipped";
      debug.finalStatus = isQuotaExceededError(debug.errorMessage) ? "UNKNOWN" : "OFFLINE";
      if (isQuotaExceededError(debug.errorMessage)) {
        return { streamer: unknownStreamer(channel, debug.errorMessage), debug };
      }
      return { streamer: offlineStreamer(channel), debug };
    }

    const livePageResult = await fetchLiveViaChannelLivePage(resolvedChannelId, apiKey);
    debug.livePageStatus = livePageResult.livePageStatus;
    debug.livePageVideoId = livePageResult.livePageVideoId;
    debug.livePageVerifyStatus = livePageResult.livePageVerifyStatus;

    if (livePageResult.errorMessage) {
      debug.errorMessage = livePageResult.errorMessage;
      if (
        isQuotaExceededError(livePageResult.errorMessage) ||
        livePageResult.livePageVerifyStatus === "error"
      ) {
        debug.finalStatus = "UNKNOWN";
        return { streamer: unknownStreamer(channel, livePageResult.errorMessage), debug };
      }
    }

    if (livePageResult.livePageVerifyStatus === "error") {
      debug.finalStatus = "UNKNOWN";
      debug.errorMessage =
        debug.errorMessage ?? "Failed to verify live page video with YouTube API";
      return { streamer: unknownStreamer(channel, debug.errorMessage), debug };
    }

    if (livePageResult.live) {
      debug.finalStatus = "LIVE";
      debug.videosListStatus = livePageResult.livePageVerifyStatus;
      return {
        streamer: liveStreamer(channel, livePageResult.live),
        debug,
      };
    }

    const uploadsResult = await fetchLiveViaUploadsPlaylist(resolvedChannelId, apiKey);
    debug.uploadsPlaylistId = uploadsResult.uploadsPlaylistId ?? "";
    debug.playlistItemsStatus = uploadsResult.playlistItemsStatus;
    debug.videosListStatus = uploadsResult.videosListStatus;
    debug.videoCheckedCount = uploadsResult.videoCheckedCount;

    if (uploadsResult.errorMessage) {
      debug.errorMessage = uploadsResult.errorMessage;
      if (isQuotaExceededError(uploadsResult.errorMessage)) {
        debug.finalStatus = "UNKNOWN";
        return { streamer: unknownStreamer(channel, uploadsResult.errorMessage), debug };
      }
    }

    if (uploadsResult.live) {
      debug.finalStatus = "LIVE";
      return {
        streamer: liveStreamer(channel, uploadsResult.live),
        debug,
      };
    }

    debug.finalStatus = "OFFLINE";
    return { streamer: offlineStreamer(channel), debug };
  } catch {
    debug.resolveStatus = debug.resolveStatus === "pending" ? "error" : debug.resolveStatus;
    debug.livePageStatus =
      debug.livePageStatus === "pending" ? "error" : debug.livePageStatus;
    debug.playlistItemsStatus =
      debug.playlistItemsStatus === "pending" ? "error" : debug.playlistItemsStatus;
    debug.finalStatus = "UNKNOWN";
    debug.errorMessage = "Unexpected error while checking YouTube live status";

    return { streamer: unknownStreamer(channel, debug.errorMessage), debug };
  }
}

export async function getAllChannelsLiveStatus(
  channels: StreamerChannel[],
  apiKey: string,
  options: LiveDetectionOptions = {},
): Promise<ChannelLiveResult[]> {
  return runBatchedChannelLiveScan(channels, apiKey, options);
}

interface ChannelScanState {
  channel: StreamerChannel;
  debug: StreamerLiveDebug;
  channelId: string | null;
  probe: LivePageProbe | null;
}

export async function runBatchedChannelLiveScan(
  channels: StreamerChannel[],
  apiKey: string,
  options: LiveDetectionOptions = {},
): Promise<ChannelLiveResult[]> {
  const resolveHandles = options.resolveHandles ?? true;

  const states: ChannelScanState[] = await processWithConcurrency(
    channels,
    REQUEST_CONCURRENCY,
    async (channel) => {
      const debug = createInitialDebug(channel);
      let channelId: string | null = null;

      if (resolveHandles) {
        const resolved = await resolveStreamerChannel(channel, apiKey);
        debug.resolveStatus = resolved.status;
        debug.resolvedChannelId = resolved.channelId ?? "";
        debug.channelHandle = resolved.channelHandle;
        debug.channelId = resolved.channelIdField || debug.channelId;
        channelId = resolved.channelId;

        if (resolved.errorMessage) {
          debug.errorMessage = resolved.errorMessage;
        }
      } else {
        channelId = getStreamerChannelIdOnly(channel);
        debug.resolveStatus = channelId ? "direct" : "missing_channel_id";
        debug.resolvedChannelId = channelId ?? "";
        debug.channelId = channelId ?? debug.channelId;

        if (!channelId) {
          debug.errorMessage = "Missing channelId";
        }
      }

      if (!channelId) {
        debug.livePageStatus = "skipped";
        debug.playlistItemsStatus = "skipped";
        debug.finalStatus = isQuotaExceededError(debug.errorMessage) ? "UNKNOWN" : "OFFLINE";
        return { channel, debug, channelId: null, probe: null };
      }

      const probe = await probeChannelLivePageById(channelId);
      debug.livePageStatus = probe.livePageStatus;
      debug.livePageVideoId = probe.livePageVideoId;

      if (probe.errorMessage) {
        debug.errorMessage = probe.errorMessage;
      }

      return { channel, debug, channelId, probe };
    },
  );

  const results: ChannelLiveResult[] = [];
  const fallbackStates: ChannelScanState[] = [];

  for (const state of states) {
    if (!state.channelId) {
      if (state.debug.finalStatus === "UNKNOWN" || isQuotaExceededError(state.debug.errorMessage)) {
        results.push({
          streamer: unknownStreamer(state.channel, state.debug.errorMessage),
          debug: state.debug,
        });
      } else {
        results.push({
          streamer: offlineStreamer(state.channel),
          debug: state.debug,
        });
      }
      continue;
    }

    if (state.probe?.errorMessage) {
      state.debug.playlistItemsStatus = "skipped";
      state.debug.finalStatus = "UNKNOWN";
      results.push({
        streamer: unknownStreamer(state.channel, state.probe.errorMessage),
        debug: state.debug,
      });
      continue;
    }

    fallbackStates.push(state);
  }

  const livePageCandidateIds = fallbackStates.flatMap((state) => state.probe?.candidateIds ?? []);
  const livePageVerification = await batchVerifyVideosById(livePageCandidateIds, apiKey);
  const livePageVerifyFailed = livePageVerification.verifyStatus === "error";
  const livePageQuotaExceeded = isQuotaExceededError(livePageVerification.errorMessage);

  const unresolvedStates: ChannelScanState[] = [];

  for (const state of fallbackStates) {
    if (livePageVerifyFailed) {
      state.debug.livePageVerifyStatus = "error";
      state.debug.playlistItemsStatus = "skipped";
      state.debug.videosListStatus = "skipped";
      state.debug.finalStatus = "UNKNOWN";
      state.debug.errorMessage =
        livePageVerification.errorMessage ?? "Failed to verify live page video with YouTube API";
      results.push({
        streamer: unknownStreamer(state.channel, state.debug.errorMessage),
        debug: state.debug,
      });
      continue;
    }

    state.debug.livePageVerifyStatus = "not_live";
    const live = findLiveForCandidates(
      state.probe?.candidateIds ?? [],
      livePageVerification.liveByVideoId,
    );

    if (live) {
      state.debug.livePageVerifyStatus = "live";
      state.debug.livePageVideoId = live.videoId;
      state.debug.finalStatus = "LIVE";
      state.debug.videosListStatus = "live";
      results.push({
        streamer: liveStreamer(state.channel, live),
        debug: state.debug,
      });
      continue;
    }

    unresolvedStates.push(state);
  }

  if (unresolvedStates.length === 0 || livePageQuotaExceeded) {
    return results;
  }

  const playlistResults = await processWithConcurrency(
    unresolvedStates,
    REQUEST_CONCURRENCY,
    async (state) => fetchUploadsPlaylistVideoIds(state.channelId!, apiKey),
  );

  const fallbackVideoIds = playlistResults.flatMap((result) => result.videoIds);
  const fallbackVerification = await batchVerifyVideosById(fallbackVideoIds, apiKey);
  const fallbackVerifyFailed = fallbackVerification.verifyStatus === "error";

  for (let index = 0; index < unresolvedStates.length; index += 1) {
    const state = unresolvedStates[index];
    const playlistResult = playlistResults[index];

    state.debug.uploadsPlaylistId = playlistResult.uploadsPlaylistId ?? "";
    state.debug.playlistItemsStatus = playlistResult.playlistItemsStatus;
    state.debug.videoCheckedCount = playlistResult.videoIds.length;

    if (playlistResult.errorMessage) {
      state.debug.errorMessage = playlistResult.errorMessage;
      if (isQuotaExceededError(playlistResult.errorMessage)) {
        state.debug.finalStatus = "UNKNOWN";
        results.push({
          streamer: unknownStreamer(state.channel, playlistResult.errorMessage),
          debug: state.debug,
        });
        continue;
      }
    }

    if (fallbackVerifyFailed) {
      state.debug.videosListStatus = "error";
      state.debug.finalStatus = "UNKNOWN";
      state.debug.errorMessage =
        fallbackVerification.errorMessage ??
        "Failed to verify uploads playlist videos with YouTube API";
      results.push({
        streamer: unknownStreamer(state.channel, state.debug.errorMessage),
        debug: state.debug,
      });
      continue;
    }

    const live = findLiveForCandidates(
      playlistResult.videoIds,
      fallbackVerification.liveByVideoId,
    );

    if (live) {
      state.debug.finalStatus = "LIVE";
      state.debug.videosListStatus = "live";
      results.push({
        streamer: liveStreamer(state.channel, live),
        debug: state.debug,
      });
      continue;
    }

    state.debug.videosListStatus = "offline";
    state.debug.finalStatus = "OFFLINE";
    results.push({
      streamer: offlineStreamer(state.channel),
      debug: state.debug,
    });
  }

  return results;
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
    livePageStatus: debug.livePageStatus,
    livePageVideoId: debug.livePageVideoId,
    livePageVerifyStatus: debug.livePageVerifyStatus,
    uploadsPlaylistId: debug.uploadsPlaylistId,
    playlistItemsStatus: debug.playlistItemsStatus,
    videosListStatus: debug.videosListStatus,
    videoCheckedCount: debug.videoCheckedCount,
    finalStatus: debug.finalStatus,
    ...(debug.errorMessage ? { errorMessage: debug.errorMessage } : {}),
  };
}
