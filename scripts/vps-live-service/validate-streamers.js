#!/usr/bin/env node
/**
 * Validate all configured streamers can be probed safely.
 *
 * Usage:
 *   node validate-streamers.js
 *   node validate-streamers.js --json
 */

const { STREAMER_CHANNELS } = require("./lib/streamers");
const {
  probeChannelLivePageById,
  isValidYouTubeVideoId,
} = require("./lib/youtube-live-page");

const REQUEST_CONCURRENCY = 4;
const REQUEST_DELAY_MS = 200;

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

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  );

  return results;
}

async function validateStreamer(channel) {
  const channelId = channel.channelId;
  const issues = [];
  const notes = [];

  if (!channelId) {
    issues.push("missing_channel_id");
    return { channel, issues, notes, probe: null };
  }

  const probe = await probeChannelLivePageById(channelId);

  if (probe.errorMessage) {
    issues.push(`live_page_error:${probe.errorMessage}`);
  }

  if (probe.livePageVideoId) {
    if (
      !isValidYouTubeVideoId(probe.livePageVideoId, { requireDigit: false })
    ) {
      issues.push("invalid_live_page_video_id");
    }

    if (!/\d/.test(probe.livePageVideoId)) {
      notes.push("letter_only_trusted_video_id");
    }
  }

  if (
    probe.trustedCandidateIds?.length > 0 &&
    probe.livePageVideoId !== probe.trustedCandidateIds[0]
  ) {
    issues.push("live_page_video_id_not_trusted_primary");
  }

  return {
    channel,
    issues,
    notes,
    probe: {
      livePageStatus: probe.livePageStatus,
      livePageVideoId: probe.livePageVideoId,
      trustedCount: probe.trustedCandidateIds?.length ?? 0,
      candidateCount: probe.candidateIds?.length ?? 0,
    },
  };
}

async function main() {
  const jsonOutput = process.argv.includes("--json");
  const results = await processWithConcurrency(
    STREAMER_CHANNELS,
    REQUEST_CONCURRENCY,
    validateStreamer,
  );

  const failed = results.filter((result) => result.issues.length > 0);
  const letterOnlyTrusted = results.filter((result) =>
    result.notes.includes("letter_only_trusted_video_id"),
  );

  const summary = {
    total: STREAMER_CHANNELS.length,
    ok: results.length - failed.length,
    failed: failed.length,
    letterOnlyTrustedIds: letterOnlyTrusted.map((result) => ({
      id: result.channel.id,
      name: result.channel.name,
      livePageVideoId: result.probe?.livePageVideoId ?? "",
    })),
    failures: failed.map((result) => ({
      id: result.channel.id,
      name: result.channel.name,
      channelId: result.channel.channelId,
      issues: result.issues,
      probe: result.probe,
    })),
  };

  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Validated ${summary.total} streamers`);
    console.log(`OK: ${summary.ok}`);
    console.log(`Issues: ${summary.failed}`);

    if (summary.letterOnlyTrustedIds.length > 0) {
      console.log("\nLetter-only trusted IDs (supported):");
      for (const entry of summary.letterOnlyTrustedIds) {
        console.log(`  - ${entry.id} (${entry.name}): ${entry.livePageVideoId}`);
      }
    }

    if (summary.failures.length > 0) {
      console.log("\nFailures:");
      for (const failure of summary.failures) {
        console.log(
          `  - ${failure.id}: ${failure.issues.join(", ")}`,
        );
      }
      process.exitCode = 1;
    }
  }

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
