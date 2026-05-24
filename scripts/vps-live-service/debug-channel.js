#!/usr/bin/env node
/**
 * Debug a single streamer channel: live page probe + YouTube API verification.
 *
 * Usage:
 *   node debug-channel.js ajaxynf
 *   node debug-channel.js UCYzFzyj2P8ANs8evXEgVueA
 */

const dotenv = require("dotenv");
const path = require("path");
const { STREAMER_CHANNELS } = require("./lib/streamers");
const { probeChannelLivePageById } = require("./lib/youtube-live-page");
const {
  runBatchedChannelLiveScan,
  getStreamerChannelIdOnly,
} = require("./lib/youtube-scanner");

dotenv.config({ path: path.join(__dirname, ".env") });

const apiKey = (process.env.YOUTUBE_API_KEY || "").trim();
const query = (process.argv[2] || "ajaxynf").trim().toLowerCase();

function resolveChannel(input) {
  const byId = STREAMER_CHANNELS.find(
    (channel) => channel.id.toLowerCase() === input,
  );
  if (byId) {
    return byId;
  }

  const byChannelId = STREAMER_CHANNELS.find(
    (channel) => getStreamerChannelIdOnly(channel)?.toLowerCase() === input,
  );
  if (byChannelId) {
    return byChannelId;
  }

  return {
    id: input,
    name: input,
    channelId: input.startsWith("UC") ? input : undefined,
    channelUrl: input.startsWith("UC")
      ? `https://www.youtube.com/channel/${input}`
      : undefined,
  };
}

async function main() {
  const channel = resolveChannel(query);
  const channelId = getStreamerChannelIdOnly(channel);

  console.log("=== Channel ===");
  console.log(JSON.stringify({ id: channel.id, name: channel.name, channelId }, null, 2));

  if (!channelId) {
    console.error("No channelId configured.");
    process.exit(1);
  }

  console.log("\n=== Live page probe ===");
  const probe = await probeChannelLivePageById(channelId);
  console.log(
    JSON.stringify(
      {
        livePageStatus: probe.livePageStatus,
        livePageVideoId: probe.livePageVideoId,
        candidateCount: probe.candidateIds.length,
        candidateIds: probe.candidateIds,
        errorMessage: probe.errorMessage,
      },
      null,
      2,
    ),
  );

  if (!apiKey) {
    console.log("\nYOUTUBE_API_KEY not set — skipping API verification.");
    process.exit(0);
  }

  console.log("\n=== Full scan (single channel) ===");
  const results = await runBatchedChannelLiveScan([channel], apiKey);
  const result = results[0];

  console.log(
    JSON.stringify(
      {
        streamer: result.streamer,
        debug: result.debug,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
