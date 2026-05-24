import type { GridLayout } from "./types";

export const LAYOUT_OPTIONS: GridLayout[] = [
  "1x1",
  "2x1",
  "2x2",
  "3x2",
  "3x3",
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
  "3x3": { slots: 9, cols: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" },
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
