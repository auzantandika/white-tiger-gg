import { hasChannelOwnershipMatch, isConfirmedLive } from "@/lib/stream-live-filter";
import type { LiveStreamer } from "@/lib/types";

export interface StreamSlotAssignment {
  streamerId: string;
  videoId: string;
}

export type StreamSlotState = StreamSlotAssignment | null;

export function buildInitialSlotAssignments(count: number): StreamSlotState[] {
  return Array.from({ length: count }, () => null);
}

export function resizeSlotAssignments(
  current: StreamSlotState[],
  newCount: number,
): StreamSlotState[] {
  if (newCount <= current.length) {
    return current.slice(0, newCount);
  }

  return [
    ...current,
    ...buildInitialSlotAssignments(newCount - current.length),
  ];
}

export function syncLiveSlotAssignments(
  current: StreamSlotState[],
  slotCount: number,
  liveStreamers: LiveStreamer[],
  skipIds: Set<string> = new Set(),
): StreamSlotState[] {
  const liveById = new Map(
    liveStreamers
      .filter(isConfirmedLive)
      .map((streamer) => [streamer.id, streamer] as const),
  );

  const next = resizeSlotAssignments(current, slotCount);

  for (let index = 0; index < next.length; index += 1) {
    const slot = next[index];
    if (!slot) {
      continue;
    }

    const liveStreamer = liveById.get(slot.streamerId);
    if (!liveStreamer?.videoId) {
      next[index] = null;
      continue;
    }

    if (slot.videoId !== liveStreamer.videoId) {
      next[index] = {
        streamerId: slot.streamerId,
        videoId: liveStreamer.videoId,
      };
    }
  }

  const assignedStreamerIds = new Set(
    next
      .filter(
        (slot): slot is StreamSlotAssignment =>
          slot !== null && !skipIds.has(slot.streamerId),
      )
      .map((slot) => slot.streamerId),
  );

  for (const liveStreamer of liveStreamers) {
    if (!isConfirmedLive(liveStreamer)) {
      continue;
    }

    if (skipIds.has(liveStreamer.id) || assignedStreamerIds.has(liveStreamer.id)) {
      continue;
    }

    const emptyIndex = next.findIndex((slot) => slot === null);
    if (emptyIndex === -1) {
      break;
    }

    next[emptyIndex] = {
      streamerId: liveStreamer.id,
      videoId: liveStreamer.videoId,
    };
    assignedStreamerIds.add(liveStreamer.id);
  }

  return next;
}

export function assignStreamerToSlot(
  current: StreamSlotState[],
  slotCount: number,
  streamer: LiveStreamer,
  targetIndex: number,
): StreamSlotState[] {
  if (!isConfirmedLive(streamer)) {
    return resizeSlotAssignments(current, slotCount);
  }

  const assignment: StreamSlotAssignment = {
    streamerId: streamer.id,
    videoId: streamer.videoId,
  };

  const next = resizeSlotAssignments(current, slotCount);
  let index = targetIndex;

  if (index < 0 || index >= next.length) {
    const emptyIndex = next.findIndex((slot) => slot === null);
    index = emptyIndex !== -1 ? emptyIndex : 0;
  }

  for (let slotIndex = 0; slotIndex < next.length; slotIndex += 1) {
    if (slotIndex !== index && next[slotIndex]?.streamerId === streamer.id) {
      next[slotIndex] = null;
    }
  }

  next[index] = assignment;
  return next;
}

export function resolveSlotForDisplay(
  slot: StreamSlotState,
  streamerMap: Map<string, LiveStreamer>,
): LiveStreamer | null {
  if (!slot) {
    return null;
  }

  const streamer = streamerMap.get(slot.streamerId);
  if (!streamer || !isConfirmedLive(streamer) || !hasChannelOwnershipMatch(streamer)) {
    return null;
  }

  return streamer;
}

export function getSlotReactKey(
  slot: StreamSlotState,
  slotIndex: number,
): string {
  if (!slot) {
    return `empty-slot-${slotIndex}`;
  }

  return `${slot.streamerId}-${slot.videoId}`;
}

export function validateSlotAssignments(
  slots: StreamSlotState[],
  streamerMap: Map<string, LiveStreamer>,
): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const seenStreamerIds = new Set<string>();

  for (const [index, slot] of slots.entries()) {
    if (!slot) {
      continue;
    }

    if (seenStreamerIds.has(slot.streamerId)) {
      console.warn(
        "[StreamingMonitor] Duplicate streamer assignment detected",
        { slotIndex: index, streamerId: slot.streamerId },
      );
    }
    seenStreamerIds.add(slot.streamerId);

    const streamer = streamerMap.get(slot.streamerId);
    if (!streamer) {
      console.warn(
        "[StreamingMonitor] Slot references unknown streamer",
        { slotIndex: index, slot },
      );
      continue;
    }

    if (streamer.id !== slot.streamerId) {
      console.warn(
        "[StreamingMonitor] Slot streamerId does not match streamer.id",
        { slotIndex: index, slotStreamerId: slot.streamerId, streamerId: streamer.id },
      );
    }

    if (isConfirmedLive(streamer) && streamer.videoId !== slot.videoId) {
      console.warn(
        "[StreamingMonitor] Slot videoId differs from live streamer videoId",
        {
          slotIndex: index,
          streamerId: slot.streamerId,
          slotVideoId: slot.videoId,
          liveVideoId: streamer.videoId,
        },
      );
    }

    if (!hasChannelOwnershipMatch(streamer)) {
      console.warn(
        "[StreamingMonitor] Streamer failed channel ownership validation",
        {
          slotIndex: index,
          streamerId: slot.streamerId,
          detectedVideoChannelId: streamer.detectedVideoChannelId,
          expectedChannelId: streamer.expectedChannelId,
        },
      );
    }
  }
}
