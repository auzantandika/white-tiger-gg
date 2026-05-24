const { probeChannelLivePageById } = require("./youtube-live-page");

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const REQUEST_CONCURRENCY = 4;
const REQUEST_DELAY_MS = 150;
const UPLOADS_PLAYLIST_MAX_RESULTS = "10";
const VIDEOS_LIST_BATCH_SIZE = 50;

const CHANNEL_MISMATCH_MESSAGE =
  "Detected live video does not belong to this streamer";

function isFallbackEnabled() {
  return process.env.YOUTUBE_ENABLE_FALLBACK === "true";
}

function normalizeYouTubeErrorMessage(message) {
  return message.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function isQuotaExceededError(message) {
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

function buildApiUrl(path, params, apiKey) {
  const search = new URLSearchParams({ ...params, key: apiKey });
  return `${YOUTUBE_API_BASE}${path}?${search.toString()}`;
}

function parseYouTubeError(body, httpStatus) {
  const message = body?.message?.trim();
  if (message) {
    return normalizeYouTubeErrorMessage(message);
  }
  return `YouTube API request failed with status ${httpStatus}`;
}

function extractChannelIdFromUrl(url) {
  const match = url.match(/\/channel\/(UC[\w-]+)/i);
  return match?.[1] ?? null;
}

function getUploadsPlaylistId(channelId) {
  if (!channelId.startsWith("UC")) {
    return null;
  }
  return `UU${channelId.slice(2)}`;
}

function thumbnailFromSnippet(snippet) {
  return (
    snippet?.thumbnails?.medium?.url ??
    snippet?.thumbnails?.default?.url ??
    ""
  );
}

function offlineStreamer(channel) {
  return {
    id: channel.id,
    name: channel.name,
    channelUrl: channel.channelUrl,
    status: "OFFLINE",
    videoId: "",
    title: "",
    thumbnail: "",
    channelId: channel.channelId,
  };
}

function unknownStreamer(channel, errorMessage) {
  return {
    id: channel.id,
    name: channel.name,
    channelUrl: channel.channelUrl,
    status: "UNKNOWN",
    videoId: "",
    title: "",
    thumbnail: "",
    channelId: channel.channelId,
    ...(errorMessage ? { errorMessage } : {}),
  };
}

function liveStreamer(channel, live, expectedChannelId) {
  return {
    id: channel.id,
    name: channel.name,
    channelUrl: channel.channelUrl,
    status: "LIVE",
    videoId: live.videoId,
    title: live.title,
    thumbnail: live.thumbnail,
    channelId: expectedChannelId,
    detectedVideoId: live.videoId,
    detectedVideoChannelId: live.channelId,
    detectedVideoChannelTitle: live.channelTitle,
    expectedChannelId,
    channelOwnershipMatch: live.channelId === expectedChannelId,
  };
}

function getStreamerChannelIdOnly(streamer) {
  const configuredId = streamer.channelId?.trim();
  if (configuredId) {
    return configuredId;
  }
  return extractChannelIdFromUrl(streamer.channelUrl);
}

function isVideoLive(item) {
  if (item.snippet?.liveBroadcastContent === "live") {
    return true;
  }
  const details = item.liveStreamingDetails;
  return Boolean(details?.actualStartTime && !details?.actualEndTime);
}

function detailsFromVideoItem(item) {
  if (!item.id) {
    return null;
  }

  return {
    videoId: item.id,
    title: item.snippet?.title ?? "",
    thumbnail: thumbnailFromSnippet(item.snippet),
    channelId: item.snippet?.channelId ?? "",
    channelTitle: item.snippet?.channelTitle ?? "",
    isLive: isVideoLive(item),
  };
}

async function batchFetchVideoDetails(videoIds, apiKey) {
  const uniqueIds = [...new Set(videoIds.filter(Boolean))];
  const videoById = new Map();

  if (uniqueIds.length === 0) {
    return { videoById, verifyStatus: "skipped" };
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
    const videosBody = await videosResponse.json();

    if (!videosResponse.ok) {
      return {
        videoById,
        verifyStatus: "error",
        errorMessage: parseYouTubeError(
          videosBody.error ?? videosBody,
          videosResponse.status,
        ),
      };
    }

    for (const item of videosBody.items ?? []) {
      const details = detailsFromVideoItem(item);
      if (details) {
        videoById.set(details.videoId, details);
      }
    }
  }

  return { videoById, verifyStatus: "ok" };
}

function verifyCandidatesForChannel(candidateIds, expectedChannelId, videoById) {
  const firstCandidateId = candidateIds[0] ?? "";
  const firstDetails = firstCandidateId ? videoById.get(firstCandidateId) : undefined;

  const baseResult = {
    detectedVideoId: firstCandidateId,
    detectedVideoChannelId: firstDetails?.channelId ?? "",
    detectedVideoChannelTitle: firstDetails?.channelTitle ?? "",
    expectedChannelId,
    channelOwnershipMatch: false,
  };

  if (candidateIds.length === 0) {
    return { live: null, verifyStatus: "skipped", ...baseResult };
  }

  for (const videoId of candidateIds) {
    const details = videoById.get(videoId);
    if (!details) {
      continue;
    }

    const belongsToStreamer = details.channelId === expectedChannelId;
    const isLive = details.isLive;

    if (isLive && belongsToStreamer) {
      return {
        live: {
          videoId: details.videoId,
          title: details.title,
          thumbnail: details.thumbnail,
          channelId: details.channelId,
          channelTitle: details.channelTitle,
        },
        verifyStatus: "live",
        detectedVideoId: details.videoId,
        detectedVideoChannelId: details.channelId,
        detectedVideoChannelTitle: details.channelTitle,
        expectedChannelId,
        channelOwnershipMatch: true,
      };
    }

    if (isLive && !belongsToStreamer) {
      return {
        live: null,
        verifyStatus: "channel_mismatch",
        detectedVideoId: details.videoId,
        detectedVideoChannelId: details.channelId,
        detectedVideoChannelTitle: details.channelTitle,
        expectedChannelId,
        channelOwnershipMatch: false,
        errorMessage: CHANNEL_MISMATCH_MESSAGE,
      };
    }
  }

  const firstMatch = firstDetails
    ? firstDetails.channelId === expectedChannelId
    : false;

  return {
    live: null,
    verifyStatus: "not_live",
    detectedVideoId: firstCandidateId,
    detectedVideoChannelId: firstDetails?.channelId ?? "",
    detectedVideoChannelTitle: firstDetails?.channelTitle ?? "",
    expectedChannelId,
    channelOwnershipMatch: firstMatch,
  };
}

function findLiveForCandidates(candidateIds, videoById, expectedChannelId) {
  return verifyCandidatesForChannel(candidateIds, expectedChannelId, videoById);
}

async function fetchUploadsPlaylistVideoIds(channelId, apiKey) {
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
  const playlistBody = await playlistResponse.json();

  if (!playlistResponse.ok) {
    return {
      uploadsPlaylistId,
      videoIds: [],
      playlistItemsStatus: "error",
      errorMessage: parseYouTubeError(
        playlistBody.error ?? playlistBody,
        playlistResponse.status,
      ),
    };
  }

  const videoIds =
    playlistBody.items
      ?.map((item) => item.contentDetails?.videoId)
      .filter(Boolean) ?? [];

  return {
    uploadsPlaylistId,
    videoIds,
    playlistItemsStatus: videoIds.length > 0 ? "ok" : "empty",
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
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

function createInitialDebug(channel) {
  const configuredChannelId =
    channel.channelId ?? extractChannelIdFromUrl(channel.channelUrl) ?? "";

  return {
    channelId: configuredChannelId,
    resolvedChannelId: "",
    resolveStatus: "pending",
    livePageStatus: "pending",
    livePageVideoId: "",
    livePageVerifyStatus: "skipped",
    detectedVideoId: "",
    detectedVideoChannelId: "",
    detectedVideoChannelTitle: "",
    expectedChannelId: configuredChannelId,
    channelOwnershipMatch: false,
    uploadsPlaylistId: "",
    playlistItemsStatus: "pending",
    videosListStatus: "skipped",
    videoCheckedCount: 0,
    finalStatus: "pending",
  };
}

async function runBatchedChannelLiveScan(channels, apiKey) {
  const states = await processWithConcurrency(
    channels,
    REQUEST_CONCURRENCY,
    async (channel) => {
      const debug = createInitialDebug(channel);
      const channelId = getStreamerChannelIdOnly(channel);

      debug.resolveStatus = channelId ? "direct" : "missing_channel_id";
      debug.resolvedChannelId = channelId ?? "";
      debug.channelId = channelId ?? debug.channelId;

      if (!channelId) {
        debug.errorMessage = "Missing channelId";
        debug.livePageStatus = "skipped";
        debug.playlistItemsStatus = "skipped";
        debug.finalStatus = "UNKNOWN";
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

  const results = [];
  const fallbackStates = [];

  for (const state of states) {
    if (!state.channelId) {
      results.push({
        streamer: unknownStreamer(state.channel, state.debug.errorMessage),
        debug: state.debug,
      });
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

  const livePageCandidateIds = fallbackStates.flatMap(
    (state) => state.probe?.candidateIds ?? [],
  );
  const livePageVerification = await batchFetchVideoDetails(
    livePageCandidateIds,
    apiKey,
  );
  const livePageVerifyFailed = livePageVerification.verifyStatus === "error";
  const livePageQuotaExceeded = isQuotaExceededError(
    livePageVerification.errorMessage,
  );

  const unresolvedStates = [];

  for (const state of fallbackStates) {
    const expectedChannelId = state.channelId;

    if (livePageVerifyFailed) {
      state.debug.livePageVerifyStatus = "error";
      state.debug.playlistItemsStatus = "skipped";
      state.debug.videosListStatus = "skipped";
      state.debug.finalStatus = "UNKNOWN";
      state.debug.expectedChannelId = expectedChannelId;
      state.debug.errorMessage =
        livePageVerification.errorMessage ??
        "Failed to verify live page video with YouTube API";
      results.push({
        streamer: unknownStreamer(state.channel, state.debug.errorMessage),
        debug: state.debug,
      });
      continue;
    }

    const verification = findLiveForCandidates(
      state.probe?.candidateIds ?? [],
      livePageVerification.videoById,
      expectedChannelId,
    );

    state.debug.detectedVideoId = verification.detectedVideoId;
    state.debug.detectedVideoChannelId = verification.detectedVideoChannelId;
    state.debug.detectedVideoChannelTitle = verification.detectedVideoChannelTitle;
    state.debug.expectedChannelId = verification.expectedChannelId;
    state.debug.channelOwnershipMatch = verification.channelOwnershipMatch;
    state.debug.livePageVerifyStatus = verification.verifyStatus;
    state.debug.livePageVideoId =
      verification.detectedVideoId || state.probe?.livePageVideoId || "";
    state.debug.expectedChannelId = expectedChannelId;

    if (verification.errorMessage) {
      state.debug.errorMessage = verification.errorMessage;
    }

    if (verification.live) {
      state.debug.finalStatus = "LIVE";
      state.debug.videosListStatus = "live";
      results.push({
        streamer: liveStreamer(state.channel, verification.live, expectedChannelId),
        debug: state.debug,
      });
      continue;
    }

    unresolvedStates.push(state);
  }

  if (unresolvedStates.length === 0 || livePageQuotaExceeded) {
    if (livePageQuotaExceeded) {
      for (const state of unresolvedStates) {
        state.debug.finalStatus = "UNKNOWN";
        state.debug.errorMessage =
          livePageVerification.errorMessage ?? "YouTube API quota exceeded";
        results.push({
          streamer: unknownStreamer(state.channel, state.debug.errorMessage),
          debug: state.debug,
        });
      }
    } else {
      for (const state of unresolvedStates) {
        state.debug.finalStatus = "OFFLINE";
        results.push({
          streamer: offlineStreamer(state.channel),
          debug: state.debug,
        });
      }
    }

    return results;
  }

  if (!isFallbackEnabled()) {
    for (const state of unresolvedStates) {
      state.debug.playlistItemsStatus = "skipped";
      state.debug.videosListStatus = "skipped";
      state.debug.finalStatus = "OFFLINE";
      results.push({
        streamer: offlineStreamer(state.channel),
        debug: state.debug,
      });
    }

    return results;
  }

  const playlistResults = await processWithConcurrency(
    unresolvedStates,
    REQUEST_CONCURRENCY,
    async (state) => fetchUploadsPlaylistVideoIds(state.channelId, apiKey),
  );

  const fallbackVideoIds = playlistResults.flatMap((result) => result.videoIds);
  const fallbackVerification = await batchFetchVideoDetails(
    fallbackVideoIds,
    apiKey,
  );
  const fallbackVerifyFailed = fallbackVerification.verifyStatus === "error";

  for (let index = 0; index < unresolvedStates.length; index += 1) {
    const state = unresolvedStates[index];
    const playlistResult = playlistResults[index];
    const expectedChannelId = state.channelId;

    state.debug.uploadsPlaylistId = playlistResult.uploadsPlaylistId ?? "";
    state.debug.playlistItemsStatus = playlistResult.playlistItemsStatus;
    state.debug.videoCheckedCount = playlistResult.videoIds.length;
    state.debug.expectedChannelId = expectedChannelId;

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

    const verification = findLiveForCandidates(
      playlistResult.videoIds,
      fallbackVerification.videoById,
      expectedChannelId,
    );

    state.debug.detectedVideoId = verification.detectedVideoId;
    state.debug.detectedVideoChannelId = verification.detectedVideoChannelId;
    state.debug.detectedVideoChannelTitle = verification.detectedVideoChannelTitle;
    state.debug.expectedChannelId = verification.expectedChannelId;
    state.debug.channelOwnershipMatch = verification.channelOwnershipMatch;

    if (verification.live) {
      state.debug.finalStatus = "LIVE";
      state.debug.videosListStatus = "live";
      results.push({
        streamer: liveStreamer(state.channel, verification.live, expectedChannelId),
        debug: state.debug,
      });
      continue;
    }

    state.debug.videosListStatus =
      verification.verifyStatus === "channel_mismatch"
        ? "channel_mismatch"
        : "offline";
    state.debug.finalStatus = "OFFLINE";
    if (verification.errorMessage) {
      state.debug.errorMessage = verification.errorMessage;
    }
    results.push({
      streamer: offlineStreamer(state.channel),
      debug: state.debug,
    });
  }

  return results;
}

async function scanYouTubeLive(channels, apiKey) {
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is not configured");
  }

  const scannableChannels = channels.filter((channel) =>
    Boolean(getStreamerChannelIdOnly(channel)),
  );
  const missingChannelId = channels.filter(
    (channel) => !getStreamerChannelIdOnly(channel),
  );

  const rawResults = await runBatchedChannelLiveScan(scannableChannels, apiKey);
  const checkedAt = new Date().toISOString();

  const streamersById = new Map(
    rawResults.map(({ streamer }) => [streamer.id, streamer]),
  );

  for (const channel of missingChannelId) {
    streamersById.set(channel.id, unknownStreamer(channel, "Missing channelId"));
  }
  const streamers = channels.map((channel) => {
    const streamer =
      streamersById.get(channel.id) ??
      unknownStreamer(channel, "Missing channelId");
    return { ...streamer, lastCheckedAt: checkedAt };
  });

  const cacheSeconds = Number(process.env.CACHE_SECONDS || 600);
  const nextScanAt = new Date(
    Date.parse(checkedAt) + cacheSeconds * 1000,
  ).toISOString();

  return {
    streamers,
    liveCount: require("./stream-live-filter").countConfirmedLive(streamers),
    totalChannels: channels.length,
    scannedCount: scannableChannels.length,
    scanBatchSize: channels.length,
    recheckedLiveCount: 0,
    livePrioritized: false,
    scannedStreamerIds: scannableChannels.map((channel) => channel.id),
    skippedStreamerIds: missingChannelId.map((channel) => channel.id),
    scanCursor: 0,
    lastCheckedAt: checkedAt,
    nextScanAt,
    scannedAt: checkedAt,
    scanner: "youtube-live-page",
    storeProvider: "vps-file",
  };
}

module.exports = {
  scanYouTubeLive,
  runBatchedChannelLiveScan,
  getStreamerChannelIdOnly,
  isFallbackEnabled,
  isQuotaExceededError,
};
