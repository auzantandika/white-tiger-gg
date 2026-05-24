"use client";

import { useCallback, useRef } from "react";
import type { LiveStreamer } from "@/lib/types";
import { buildEmbedUrl, toggleContainerFullscreen } from "@/lib/stream-player";
import StreamPlayerActions from "./StreamPlayerActions";

interface FocusedStreamViewProps {
  streamer: LiveStreamer;
  onBack: () => void;
  isExpanded?: boolean;
  withSidebar?: boolean;
}

export default function FocusedStreamView({
  streamer,
  onBack,
  isExpanded = false,
  withSidebar = false,
}: FocusedStreamViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFullscreen = useCallback(async () => {
    await toggleContainerFullscreen(containerRef.current);
  }, []);

  const playerMinHeight = isExpanded
    ? "min-h-[min(80vh,980px)] lg:min-h-[min(82vh,1000px)]"
    : withSidebar
      ? "min-h-[220px] sm:min-h-[360px] lg:min-h-[min(68vh,780px)]"
      : "min-h-[220px] sm:min-h-[360px] lg:min-h-[min(72vh,820px)]";

  return (
    <div className="flex min-w-0 flex-col gap-3 transition-[width] duration-300 ease-in-out">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm uppercase tracking-wider text-white sm:text-base">
            {streamer.name}
          </p>
          {streamer.title && (
            <p className="truncate font-mono text-[10px] text-zinc-500">
              {streamer.title}
            </p>
          )}
        </div>
        <StreamPlayerActions
          videoId={streamer.videoId}
          onFullscreen={handleFullscreen}
          onBack={onBack}
          showBack
        />
      </div>

      <div
        ref={containerRef}
        className={`relative aspect-video w-full overflow-hidden border border-blue-800/50 bg-black transition-[min-height] duration-300 ease-in-out ${playerMinHeight}`}
      >
        <iframe
          key={`${streamer.id}-${streamer.videoId}`}
          src={buildEmbedUrl(streamer.videoId)}
          title={`${streamer.name} live stream`}
          className="absolute inset-0 h-full w-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        />
      </div>
    </div>
  );
}
