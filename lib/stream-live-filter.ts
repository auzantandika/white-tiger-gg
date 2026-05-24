import { hasAllowedStreamTag, getMatchedTags } from "./stream-tags";
import type { LiveStreamer } from "./types";

export type LiveFilterMode = "all-live" | "tagged-only";

export function isConfirmedLive(streamer: LiveStreamer): boolean {
  return streamer.status === "LIVE" && Boolean(streamer.videoId);
}

export function enrichStreamerWithTags(streamer: LiveStreamer): LiveStreamer {
  const matchedTags = getMatchedTags(streamer.title);
  return {
    ...streamer,
    matchedTags,
    hasAllowedTag: matchedTags.length > 0,
  };
}

export function enrichStreamersWithTags(streamers: LiveStreamer[]): LiveStreamer[] {
  return streamers.map(enrichStreamerWithTags);
}

export function getLiveStreamers(streamers: LiveStreamer[]): LiveStreamer[] {
  return streamers.filter(isConfirmedLive);
}

export function getTaggedLiveStreamers(streamers: LiveStreamer[]): LiveStreamer[] {
  return getLiveStreamers(streamers).filter((streamer) => {
    if (streamer.hasAllowedTag === true) {
      return true;
    }
    if (streamer.hasAllowedTag === false) {
      return false;
    }
    return hasAllowedStreamTag(streamer.title);
  });
}

export function getLiveStreamerIds(
  streamers: LiveStreamer[],
  mode: LiveFilterMode = "all-live",
): string[] {
  const list =
    mode === "tagged-only"
      ? getTaggedLiveStreamers(streamers)
      : getLiveStreamers(streamers);

  return list.map((streamer) => streamer.id);
}

export function hasPendingLiveChecks(streamers: LiveStreamer[]): boolean {
  return streamers.some((streamer) => streamer.status === "UNKNOWN");
}
