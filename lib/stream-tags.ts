/** Tags matched against live stream titles (case-insensitive). */
export const ALLOWED_STREAM_TAGS = [
  "white tiger",
  "white tiger gg",
  "wt gg",
  "[wt]",
  "#wt",
  "wtl",
  "wt |",
  "| wt",
] as const;

export function getMatchedTags(title: string | undefined): string[] {
  if (!title?.trim()) {
    return [];
  }

  const normalized = title.toLowerCase();
  return ALLOWED_STREAM_TAGS.filter((tag) => normalized.includes(tag));
}

export function hasAllowedStreamTag(title: string | undefined): boolean {
  return getMatchedTags(title).length > 0;
}
