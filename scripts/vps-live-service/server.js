const cors = require("cors");
const cron = require("node-cron");
const dotenv = require("dotenv");
const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { countConfirmedLive } = require("./lib/stream-live-filter");
const { STREAMER_CHANNELS } = require("./lib/streamers");
const { probeChannelLivePageById } = require("./lib/youtube-live-page");
const {
  isQuotaExceededError,
  runBatchedChannelLiveScan,
  scanYouTubeLive,
  getStreamerChannelIdOnly,
} = require("./lib/youtube-scanner");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const CACHE_SECONDS = Number(process.env.CACHE_SECONDS || 600);
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "*/10 * * * *";
const LIVE_DATA_API_TOKEN = (process.env.LIVE_DATA_API_TOKEN || "").trim();
const YOUTUBE_API_KEY = (process.env.YOUTUBE_API_KEY || "").trim();

const DATA_DIR = path.join(__dirname, "data");
const CACHE_FILE = path.join(DATA_DIR, "live-cache.json");
const PM2_NAME = "white-tiger-live-service";

let scanInProgress = false;

app.use(cors());
app.use(express.json());

function getTokenFromRequest(req) {
  const authorization = req.headers.authorization || "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    return bearerMatch[1].trim();
  }

  const queryToken = req.query.token;
  if (typeof queryToken === "string") {
    return queryToken.trim();
  }

  return "";
}

function isAuthorized(req) {
  if (!LIVE_DATA_API_TOKEN) {
    return false;
  }

  return getTokenFromRequest(req) === LIVE_DATA_API_TOKEN;
}

function unauthorizedResponse(res) {
  return res.status(401).json({
    error: "Unauthorized",
    hasApiTokenConfigured: LIVE_DATA_API_TOKEN.length > 0,
  });
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readCacheFile() {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeCacheFile(payload) {
  await ensureDataDir();
  await fs.writeFile(CACHE_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function buildLiveDataResponse(cache) {
  if (!cache) {
    return {
      streamers: STREAMER_CHANNELS.map((channel) => ({
        id: channel.id,
        name: channel.name,
        channelUrl: channel.channelUrl,
        status: "UNKNOWN",
        videoId: "",
        title: "",
        thumbnail: "",
        errorMessage: "Live data has not been scanned yet.",
      })),
      liveCount: 0,
      totalChannels: STREAMER_CHANNELS.length,
      lastCheckedAt: null,
      nextScanAt: null,
      scannedCount: 0,
      message: "Live data has not been scanned yet.",
      cacheStale: true,
      cacheSeconds: CACHE_SECONDS,
      cacheAgeSeconds: null,
      source: "vps-file",
      storeProvider: "vps-file",
    };
  }

  const scannedAtMs = Date.parse(cache.scannedAt || cache.lastCheckedAt || "");
  const cacheAgeSeconds = Number.isFinite(scannedAtMs)
    ? Math.max(0, Math.floor((Date.now() - scannedAtMs) / 1000))
    : null;

  return {
    streamers: cache.streamers || [],
    liveCount: cache.liveCount ?? countConfirmedLive(cache.streamers || []),
    totalChannels: cache.totalChannels ?? STREAMER_CHANNELS.length,
    lastCheckedAt: cache.lastCheckedAt ?? null,
    nextScanAt: cache.nextScanAt ?? null,
    scannedCount: cache.scannedCount ?? 0,
    scanBatchSize: cache.scanBatchSize ?? 0,
    recheckedLiveCount: cache.recheckedLiveCount ?? 0,
    livePrioritized: cache.livePrioritized ?? false,
    scannedStreamerIds: cache.scannedStreamerIds ?? [],
    skippedStreamerIds: cache.skippedStreamerIds ?? [],
    cacheStale:
      cacheAgeSeconds === null ? true : cacheAgeSeconds > CACHE_SECONDS,
    cacheSeconds: CACHE_SECONDS,
    cacheAgeSeconds,
    source: "vps-file",
    storeProvider: "vps-file",
    scanner: cache.scanner || "youtube-live-page",
  };
}

async function runScan(trigger = "cron") {
  if (scanInProgress) {
    return {
      ok: false,
      skipped: true,
      reason: "scan_already_in_progress",
      trigger,
    };
  }

  if (!YOUTUBE_API_KEY) {
    throw new Error("YOUTUBE_API_KEY is not configured");
  }

  scanInProgress = true;

  try {
    const previousCache = await readCacheFile().catch(() => null);
    const payload = await scanYouTubeLive(STREAMER_CHANNELS, YOUTUBE_API_KEY, {
      previousCache,
    });
    payload.ok = true;
    payload.trigger = trigger;
    await writeCacheFile(payload);
    console.log(
      `[${PM2_NAME}] Scan saved (${trigger}) at ${payload.scannedAt} — live=${payload.liveCount}`,
    );
    return payload;
  } finally {
    scanInProgress = false;
  }
}

app.get("/health", async (_req, res) => {
  const cache = await readCacheFile().catch(() => null);

  res.json({
    ok: true,
    service: PM2_NAME,
    port: PORT,
    hasToken: LIVE_DATA_API_TOKEN.length > 0,
    hasYouTubeKey: YOUTUBE_API_KEY.length > 0,
    hasApiTokenConfigured: LIVE_DATA_API_TOKEN.length > 0,
    hasYoutubeApiKeyConfigured: YOUTUBE_API_KEY.length > 0,
    cacheFile: "./data/live-cache.json",
    cacheExists: Boolean(cache),
    lastScannedAt: cache?.scannedAt ?? cache?.lastCheckedAt ?? null,
    cronSchedule: CRON_SCHEDULE,
    totalChannels: STREAMER_CHANNELS.length,
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

app.get("/live-data", async (_req, res) => {
  try {
    const cache = await readCacheFile();
    res.set("Cache-Control", "no-store");
    res.json(buildLiveDataResponse(cache));
  } catch (error) {
    res.status(500).json({
      error: "Failed to read live cache",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

function resolveStreamerChannel(query) {
  const normalized = String(query || "").trim().toLowerCase();
  const byId = STREAMER_CHANNELS.find(
    (channel) => channel.id.toLowerCase() === normalized,
  );
  if (byId) {
    return byId;
  }

  return STREAMER_CHANNELS.find(
    (channel) => getStreamerChannelIdOnly(channel)?.toLowerCase() === normalized,
  );
}

app.get("/debug-channel/:streamerId", async (req, res) => {
  if (!isAuthorized(req)) {
    return unauthorizedResponse(res);
  }

  const channel =
    resolveStreamerChannel(req.params.streamerId) ??
    resolveStreamerChannel("ajaxynf");

  if (!channel) {
    return res.status(404).json({ error: "Streamer not found" });
  }

  const channelId = getStreamerChannelIdOnly(channel);
  if (!channelId) {
    return res.status(400).json({ error: "Missing channelId" });
  }

  try {
    const probe = await probeChannelLivePageById(channelId);
    const payload = {
      channel: {
        id: channel.id,
        name: channel.name,
        channelId,
      },
      probe,
    };

    if (!YOUTUBE_API_KEY) {
      return res.json({
        ...payload,
        scan: null,
        message: "YOUTUBE_API_KEY is not configured",
      });
    }

    const scanResults = await runBatchedChannelLiveScan([channel], YOUTUBE_API_KEY);
    const scan = scanResults[0] ?? null;

    return res.json({
      ...payload,
      scan,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to debug channel";
    const status = isQuotaExceededError(message) ? 429 : 500;
    return res.status(status).json({ error: message });
  }
});

app.post("/scan-now", async (req, res) => {
  if (!isAuthorized(req)) {
    return unauthorizedResponse(res);
  }

  try {
    const result = await runScan("manual");
    if (result.skipped) {
      return res.status(409).json(result);
    }

    res.json({
      ok: true,
      scannedCount: result.scannedCount,
      liveCount: result.liveCount,
      totalChannels: result.totalChannels,
      lastCheckedAt: result.lastCheckedAt,
      nextScanAt: result.nextScanAt,
      trigger: result.trigger,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scan YouTube live status";
    const status = isQuotaExceededError(message) ? 429 : 502;

    res.status(status).json({ error: message });
  }
});

async function start() {
  await ensureDataDir();

  if (!cron.validate(CRON_SCHEDULE)) {
    throw new Error(`Invalid CRON_SCHEDULE: ${CRON_SCHEDULE}`);
  }

  cron.schedule(CRON_SCHEDULE, () => {
    runScan("cron").catch((error) => {
      console.error(`[${PM2_NAME}] Scheduled scan failed:`, error);
    });
  });

  if (YOUTUBE_API_KEY) {
    const cache = await readCacheFile().catch(() => null);
    const scannedAtMs = Date.parse(
      cache?.scannedAt ?? cache?.lastCheckedAt ?? "",
    );
    const cacheAgeSeconds = Number.isFinite(scannedAtMs)
      ? Math.max(0, Math.floor((Date.now() - scannedAtMs) / 1000))
      : Number.POSITIVE_INFINITY;
    const shouldScanOnStartup = !cache || cacheAgeSeconds >= CACHE_SECONDS;

    if (shouldScanOnStartup) {
      runScan("startup").catch((error) => {
        console.error(`[${PM2_NAME}] Startup scan failed:`, error);
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[${PM2_NAME}] Listening on http://0.0.0.0:${PORT}`);
    console.log(`[${PM2_NAME}] Cron schedule: ${CRON_SCHEDULE}`);
    console.log(`[${PM2_NAME}] Streamers configured: ${STREAMER_CHANNELS.length}`);
  });
}

start().catch((error) => {
  console.error(`[${PM2_NAME}] Failed to start:`, error);
  process.exit(1);
});
