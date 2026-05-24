const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const INVALID_VIDEO_ID_BLOCKLIST = new Set(["live_stream"]);

const LIVE_PAGE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function isValidYouTubeVideoId(videoId) {
  if (!YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
    return false;
  }

  if (INVALID_VIDEO_ID_BLOCKLIST.has(videoId)) {
    return false;
  }

  return /\d/.test(videoId);
}

function extractVideoIdsFromLivePage(html, finalUrl) {
  const candidates = new Set();

  const addCandidate = (value) => {
    if (value && isValidYouTubeVideoId(value)) {
      candidates.add(value);
    }
  };

  addCandidate(finalUrl.match(/[?&]v=([\w-]{11})/)?.[1]);
  addCandidate(finalUrl.match(/\/live\/([\w-]{11})/)?.[1]);

  const patterns = [
    /rel="canonical"\s+href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})/i,
    /property="og:url"\s+content="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/i,
    /"og:url"\s+content="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/i,
    /"url"\s*:\s*"https:\\\/\\\/www\.youtube\.com\\\/watch\?v=([\w-]{11})"/i,
    /"videoId"\s*:\s*"([\w-]{11})"/g,
    /watch\?v=([\w-]{11})/g,
    /\/embed\/([\w-]{11})/g,
    /\/live\/([\w-]{11})/g,
  ];

  for (const pattern of patterns) {
    if (pattern.global) {
      for (const match of html.matchAll(pattern)) {
        addCandidate(match[1]);
      }
    } else {
      addCandidate(html.match(pattern)?.[1]);
    }
  }

  return [...candidates];
}

async function fetchChannelLivePageHtml(channelId) {
  const url = `https://www.youtube.com/channel/${channelId}/live`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent": LIVE_PAGE_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
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

async function probeChannelLivePageById(channelId) {
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

module.exports = {
  extractVideoIdsFromLivePage,
  fetchChannelLivePageHtml,
  probeChannelLivePageById,
};
