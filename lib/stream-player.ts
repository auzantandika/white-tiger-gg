export function buildEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    playsinline: "1",
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function openYouTubeVideo(videoId: string): void {
  window.open(
    `https://www.youtube.com/watch?v=${videoId}`,
    "_blank",
    "noopener,noreferrer",
  );
}

export async function toggleContainerFullscreen(
  element: HTMLElement | null,
): Promise<void> {
  if (!element) {
    return;
  }

  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }

  await element.requestFullscreen();
}
