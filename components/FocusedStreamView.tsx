"use client";

import { useCallback, useRef } from "react";
import type { LiveStreamer } from "@/lib/types";
import { buildEmbedUrl, toggleContainerFullscreen } from "@/lib/stream-player";
import StreamPlayerActions from "./StreamPlayerActions";

interface FocusedStreamViewProps {
  streamer: LiveStreamer;
  onBack: () => void;
}

export default function FocusedStreamView({
  streamer,
  onBack,
}: FocusedStreamViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFullscreen = useCallback(async () => {
    await toggleContainerFullscreen(containerRef.current);
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-3">
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
        className="relative aspect-video w-full min-h-[220px] overflow-hidden border border-blue-800/50 bg-black sm:min-h-[360px] lg:min-h-[min(72vh,820px)]"
      >
        <iframe
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
