import type { LiveStreamer } from "./types";
import { isQuotaExceededError } from "./youtube-server";

export function getStreamerStatusLabel(streamer: LiveStreamer): string {
  if (streamer.status === "LIVE") {
    return "LIVE";
  }

  if (streamer.status === "OFFLINE") {
    return "OFFLINE";
  }

  if (isQuotaExceededError(streamer.errorMessage)) {
    return "API LIMITED";
  }

  return "NOT CHECKED";
}

export function formatLastChecked(timestamp: string | null | undefined): string {
  if (!timestamp) {
    return "Not yet checked";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Not yet checked";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
