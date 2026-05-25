const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const INVALID_VIDEO_ID_BLOCKLIST = new Set(["live_stream"]);

const LIVE_PAGE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const CONSENT_COOKIE = "CONSENT=YES+cb.20210328-17-p0.en+FX+667";

function isValidYouTubeVideoId(videoId, options = {}) {
  const requireDigit = options.requireDigit ?? true;

  if (!YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
    return false;
  }

  if (INVALID_VIDEO_ID_BLOCKLIST.has(videoId)) {
    return false;
  }

  if (requireDigit && !/\d/.test(videoId)) {
    return false;
  }

  return true;
}

function extractJsonObjectAfterMarker(html, marker) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const jsonStart = html.indexOf("{", markerIndex);
  if (jsonStart === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = jsonStart; index < html.length; index += 1) {
    const char = html[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(jsonStart, index + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function extractPlayerResponseFromHtml(html) {
  const player =
    extractJsonObjectAfterMarker(html, "ytInitialPlayerResponse") ??
    extractJsonObjectAfterMarker(html, 'var ytInitialPlayerResponse =');

  if (!player?.videoDetails?.videoId) {
    return null;
  }

  return {
    videoId: player.videoDetails.videoId,
    channelId: player.videoDetails.channelId ?? "",
    isLiveContent: Boolean(player.videoDetails.isLiveContent),
  };
}

function extractTrustedVideoIdsFromLivePage(html, finalUrl, expectedChannelId) {
  const ordered = [];
  const seen = new Set();

  const addCandidate = (value) => {
    if (
      !value ||
      !isValidYouTubeVideoId(value, { requireDigit: false }) ||
      seen.has(value)
    ) {
      return;
    }

    seen.add(value);
    ordered.push(value);
  };

  const addFromPattern = (pattern, source) => {
    if (pattern.global) {
      for (const match of source.matchAll(pattern)) {
        addCandidate(match[1]);
      }
      return;
    }

    addCandidate(source.match(pattern)?.[1]);
  };

  addCandidate(finalUrl.match(/[?&]v=([\w-]{11})/)?.[1]);
  addCandidate(finalUrl.match(/\/live\/([\w-]{11})/)?.[1]);

  const trustedPatterns = [
    /rel="canonical"\s+href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})/i,
    /href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"\s+rel="canonical"/i,
    /property="og:url"\s+content="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/i,
    /"og:url"\s+content="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/i,
    /"url"\s*:\s*"https:\\\/\\\/www\.youtube\.com\\\/watch\?v=([\w-]{11})"/i,
    /"currentVideoEndpoint"\s*:\s*\{[^}]*"videoId"\s*:\s*"([\w-]{11})"/,
  ];

  for (const pattern of trustedPatterns) {
    addFromPattern(pattern, html);
  }

  const player = extractPlayerResponseFromHtml(html);
  if (player?.videoId) {
    if (!expectedChannelId || player.channelId === expectedChannelId) {
      addCandidate(player.videoId);
    }
  }

  return ordered;
}

function extractVideoIdsFromLivePage(html, finalUrl, expectedChannelId) {
  const ordered = [];
  const seen = new Set();

  const addCandidate = (value, options = {}) => {
    if (!value || !isValidYouTubeVideoId(value, options) || seen.has(value)) {
      return;
    }

    seen.add(value);
    ordered.push(value);
  };

  const addFromPattern = (pattern, source, options = {}) => {
    if (pattern.global) {
      for (const match of source.matchAll(pattern)) {
        addCandidate(match[1], options);
      }
      return;
    }

    addCandidate(source.match(pattern)?.[1], options);
  };

  for (const trustedId of extractTrustedVideoIdsFromLivePage(
    html,
    finalUrl,
    expectedChannelId,
  )) {
    addCandidate(trustedId, { requireDigit: false });
  }

  const noisyPatterns = [
    /"videoId"\s*:\s*"([\w-]{11})"/g,
    /watch\?v=([\w-]{11})/g,
    /\/embed\/([\w-]{11})/g,
    /\/live\/([\w-]{11})/g,
  ];

  for (const pattern of noisyPatterns) {
    addFromPattern(pattern, html);
  }

  return ordered;
}

function buildLivePageHeaders(includeConsentCookie = true) {
  const headers = {
    "User-Agent": LIVE_PAGE_USER_AGENT,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  };

  if (includeConsentCookie) {
    headers.Cookie = CONSENT_COOKIE;
  }

  return headers;
}

async function fetchChannelLivePageHtml(channelId, options = {}) {
  const includeConsentCookie = options.includeConsentCookie ?? true;
  const url = `https://www.youtube.com/channel/${channelId}/live`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: buildLivePageHeaders(includeConsentCookie),
    });

    const html = await response.text();

    if (!response.ok) {
      return {
        html,
        finalUrl: response.url,
        httpStatus: response.status,
        errorMessage: `Channel live page returned HTTP ${response.status}`,
      };
    }

    return {
      html,
      finalUrl: response.url,
      httpStatus: response.status,
    };
  } catch {
    return {
      html: "",
      finalUrl: url,
      httpStatus: 0,
      errorMessage: "Failed to fetch channel live page",
    };
  }
}

async function probeChannelLivePageById(channelId, attempt = 0) {
  const page = await fetchChannelLivePageHtml(channelId, {
    includeConsentCookie: attempt !== 1,
  });

  if (page.errorMessage) {
    return {
      livePageStatus: "error",
      livePageVideoId: "",
      trustedCandidateIds: [],
      candidateIds: [],
      errorMessage: page.errorMessage,
    };
  }

  const trustedCandidateIds = extractTrustedVideoIdsFromLivePage(
    page.html,
    page.finalUrl,
    channelId,
  );
  const candidateIds = extractVideoIdsFromLivePage(
    page.html,
    page.finalUrl,
    channelId,
  );

  if (trustedCandidateIds.length === 0 && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 400 : 800));
    return probeChannelLivePageById(channelId, attempt + 1);
  }

  // After all HTML retries, fall back to RSS feed (free, no API quota).
  // RSS is scoped to the channel so ownership is guaranteed — API still
  // confirms which video is actually live.
  if (trustedCandidateIds.length === 0) {
    const rssIds = await fetchRssVideoIds(channelId);
    if (rssIds.length > 0) {
      return {
        livePageStatus: "rss_fallback",
        livePageVideoId: rssIds[0],
        trustedCandidateIds: rssIds,
        candidateIds,
      };
    }
  }

  if (candidateIds.length === 0) {
    return {
      livePageStatus: "no_video",
      livePageVideoId: "",
      trustedCandidateIds: [],
      candidateIds: [],
    };
  }

  const livePageVideoId = trustedCandidateIds[0] ?? "";

  return {
    livePageStatus: trustedCandidateIds.length > 0 ? "video_found" : "no_trusted_video",
    livePageVideoId,
    trustedCandidateIds,
    candidateIds,
  };
}

async function fetchRssVideoIds(channelId) {
  try {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "Accept": "application/xml,text/xml,*/*" },
    });
    if (!response.ok) return [];
    const text = await response.text();
    const ids = [];
    for (const m of text.matchAll(/<yt:videoId>([\w-]{11})<\/yt:videoId>/g)) {
      ids.push(m[1]);
    }
    return ids.slice(0, 5);
  } catch {
    return [];
  }
}

module.exports = {
  extractVideoIdsFromLivePage,
  extractTrustedVideoIdsFromLivePage,
  extractPlayerResponseFromHtml,
  fetchChannelLivePageHtml,
  probeChannelLivePageById,
  isValidYouTubeVideoId,
};
