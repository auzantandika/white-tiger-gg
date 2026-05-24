import type { GridLayout } from "./types";

export const LAYOUT_OPTIONS: GridLayout[] = [
  "1x1",
  "2x1",
  "2x2",
  "3x2",
  "4x2",
  "ALL",
];

export const FIXED_LAYOUT_SLOTS: Record<
  Exclude<GridLayout, "ALL">,
  { slots: number; cols: string }
> = {
  "1x1": { slots: 1, cols: "grid-cols-1" },
  "2x1": { slots: 2, cols: "grid-cols-1 md:grid-cols-2" },
  "2x2": { slots: 4, cols: "grid-cols-1 md:grid-cols-2" },
  "3x2": { slots: 6, cols: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" },
  "4x2": { slots: 8, cols: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" },
};

export function getAllLayoutSlots(liveIds: string[]): number {
  return Math.max(liveIds.length, 1);
}

export function getAllLayoutCols(slotCount: number): string {
  if (slotCount <= 1) return "grid-cols-1";
  if (slotCount <= 2) return "grid-cols-1 md:grid-cols-2";
  if (slotCount <= 4) return "grid-cols-1 md:grid-cols-2";
  if (slotCount <= 6) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

export function suggestLayoutForLiveCount(liveCount: number): GridLayout {
  if (liveCount <= 1) return "1x1";
  if (liveCount === 2) return "2x1";
  if (liveCount <= 4) return "2x2";
  if (liveCount <= 6) return "3x2";
  if (liveCount <= 8) return "4x2";
  return "ALL";
}

export function getSlotCountForLayout(
  layout: GridLayout,
  liveIds: string[],
): number {
  if (layout === "ALL") {
    return getAllLayoutSlots(liveIds);
  }
  return FIXED_LAYOUT_SLOTS[layout].slots;
}

export function buildInitialAssignments(count: number): (string | null)[] {
  return Array.from({ length: count }, () => null);
}

export function resizeAssignments(
  current: (string | null)[],
  newCount: number,
): (string | null)[] {
  if (newCount <= current.length) {
    return current.slice(0, newCount);
  }
  return [...current, ...buildInitialAssignments(newCount - current.length)];
}

export function syncLiveAssignments(
  current: (string | null)[],
  slotCount: number,
  liveIds: string[],
  skipIds: Set<string> = new Set(),
): (string | null)[] {
  const liveSet = new Set(liveIds);
  const next = resizeAssignments(current, slotCount);

  for (let i = 0; i < next.length; i++) {
    const assignedId = next[i];
    if (assignedId && !liveSet.has(assignedId)) {
      next[i] = null;
    }
  }

  const assigned = new Set(
    next.filter((id): id is string => id !== null && !skipIds.has(id)),
  );

  for (const id of liveIds) {
    if (skipIds.has(id) || assigned.has(id)) continue;

    const emptyIndex = next.findIndex((slotId) => slotId === null);
    if (emptyIndex === -1) break;

    next[emptyIndex] = id;
    assigned.add(id);
  }

  return next;
}

export function assignStreamerToSlot(
  current: (string | null)[],
  slotCount: number,
  streamerId: string,
  targetIndex: number,
): (string | null)[] {
  const next = resizeAssignments(current, slotCount);
  let index = targetIndex;

  if (index < 0 || index >= next.length) {
    const emptyIndex = next.findIndex((id) => id === null);
    index = emptyIndex !== -1 ? emptyIndex : 0;
  }

  for (let i = 0; i < next.length; i++) {
    if (i !== index && next[i] === streamerId) {
      next[i] = null;
    }
  }

  next[index] = streamerId;
  return next;
}
