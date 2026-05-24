import type { LiveStreamer } from "./types";
import { isQuotaExceededError } from "./youtube-server";

export function isApiLimitedError(message?: string): boolean {
  if (!message) {
    return false;
  }

  if (isQuotaExceededError(message)) {
    return true;
  }

  const lower = message.toLowerCase();
  return (
    lower.includes("youtube api request failed") ||
    lower.includes("youtube api") ||
    lower.includes("api key") ||
    lower.includes("forbidden") ||
    lower.includes("access not configured")
  );
}

export function getStreamerStatusLabel(streamer: LiveStreamer): string {
  if (streamer.status === "LIVE") {
    return "LIVE";
  }

  if (streamer.status === "OFFLINE") {
    return "OFFLINE";
  }

  if (isApiLimitedError(streamer.errorMessage)) {
    return "API LIMITED";
  }

  return "PENDING CHECK";
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

export function formatScanBatchMessage(batchSize: number): string {
  return `Scanning ${batchSize} streamers per cycle to protect quota`;
}
