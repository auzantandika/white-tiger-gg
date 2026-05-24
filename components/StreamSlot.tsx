"use client";

import { useCallback, useRef } from "react";
import type { LiveStreamer } from "@/lib/types";
import { getStreamerStatusLabel, isApiLimitedError } from "@/lib/stream-status";
import { buildEmbedUrl, toggleContainerFullscreen } from "@/lib/stream-player";
import StreamPlayerActions from "./StreamPlayerActions";

interface StreamSlotProps {
  streamer: LiveStreamer | null;
  isSelected: boolean;
  isLarge?: boolean;
  onSelect: () => void;
  onClear: () => void;
  onFocus?: () => void;
}

export default function StreamSlot({
  streamer,
  isSelected,
  isLarge = false,
  onSelect,
  onClear,
  onFocus,
}: StreamSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasVideo = Boolean(streamer?.videoId);
  const hasChannel =
    Boolean(streamer?.channelUrl) && streamer?.channelUrl !== "#";
  const isApiLimited =
    streamer?.status === "UNKNOWN" && isApiLimitedError(streamer.errorMessage);

  const handleFullscreen = useCallback(async () => {
    await toggleContainerFullscreen(containerRef.current);
  }, []);

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (hasVideo && onFocus) {
        event.preventDefault();
        event.stopPropagation();
        onFocus();
      }
    },
    [hasVideo, onFocus],
  );

  return (
    <div
      className={`group flex min-w-0 flex-col gap-1.5 ${
        isLarge ? "min-h-[min(55vh,720px)]" : ""
      }`}
    >
      <div
        ref={containerRef}
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        className={`relative w-full min-w-0 overflow-hidden border bg-black transition-all ${
          isLarge ? "min-h-[min(55vh,720px)] flex-1" : "aspect-video"
        } ${
          isSelected
            ? "border-blue-500 ring-1 ring-blue-500/40"
            : hasVideo
              ? "border-blue-900/40 hover:border-blue-700/60"
              : "border-white/10 hover:border-white/20"
        }`}
      >
        {!streamer && (
          <div className="flex h-full min-h-[inherit] flex-col items-center justify-center gap-1.5 px-3 text-center">
            <span className="text-xl font-light text-zinc-700">+</span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">
              Waiting for live stream
            </span>
          </div>
        )}

        {streamer && hasVideo && (
          <>
            <iframe
              src={buildEmbedUrl(streamer.videoId)}
              title={`${streamer.name} live stream`}
              className="absolute inset-0 h-full w-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-10">
              <p className="truncate font-mono text-[10px] uppercase tracking-wider text-white sm:text-xs">
                {streamer.name}
              </p>
            </div>
          </>
        )}

        {streamer && !hasVideo && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
            <span
              className={`font-mono text-[10px] uppercase tracking-widest ${
                isApiLimited ? "text-amber-500/80" : "text-zinc-500"
              }`}
            >
              {streamer.status === "UNKNOWN"
                ? getStreamerStatusLabel(streamer)
                : streamer.status === "OFFLINE"
                  ? "Offline"
                  : streamer.status}
            </span>
            <p className="truncate text-sm font-medium text-white">{streamer.name}</p>
            {hasChannel && (
              <a
                href={streamer.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="border border-white/10 px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-zinc-400 hover:border-blue-600/40 hover:text-blue-300"
              >
                Open Channel
              </a>
            )}
          </div>
        )}
      </div>

      {streamer && hasVideo && (
        <div
          className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <StreamPlayerActions
            videoId={streamer.videoId}
            onFullscreen={handleFullscreen}
            onClear={onClear}
            showClear
            compact
          />
        </div>
      )}
    </div>
  );
}
