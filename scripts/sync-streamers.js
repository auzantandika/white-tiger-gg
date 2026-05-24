#!/usr/bin/env node
/**
 * Sync lib/streamers.ts -> scripts/vps-live-service/lib/streamers.js
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const tsPath = path.join(root, "lib", "streamers.ts");
const jsPath = path.join(
  root,
  "scripts",
  "vps-live-service",
  "lib",
  "streamers.js",
);

const ts = fs.readFileSync(tsPath, "utf8");
const match = ts.match(
  /export const STREAMER_CHANNELS:[\s\S]*?=\s*(\[[\s\S]*?\]);/,
);

if (!match) {
  console.error("Could not parse STREAMER_CHANNELS from lib/streamers.ts");
  process.exit(1);
}

let channels;
try {
  channels = Function(`"use strict"; return (${match[1]});`)();
} catch (error) {
  console.error("Failed to evaluate STREAMER_CHANNELS array:", error);
  process.exit(1);
}

for (const channel of channels) {
  if (!channel.id || !channel.name || !channel.channelUrl) {
    console.error("Invalid streamer entry:", channel);
    process.exit(1);
  }

  if (!channel.channelId) {
    console.error(`Missing channelId for ${channel.id}`);
    process.exit(1);
  }

  if (!/^UC[\w-]{22}$/.test(channel.channelId)) {
    console.error(`Invalid channelId for ${channel.id}: ${channel.channelId}`);
    process.exit(1);
  }
}

const output = `/** Auto-synced from lib/streamers.ts */\nmodule.exports = {\n  STREAMER_CHANNELS: ${JSON.stringify(channels, null, 2)},\n};\n`;

fs.writeFileSync(jsPath, output, "utf8");
console.log(`Synced ${channels.length} streamers to ${jsPath}`);
