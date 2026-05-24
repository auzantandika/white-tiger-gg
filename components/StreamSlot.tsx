import type { LiveStreamer } from "@/lib/types";
import { getStreamerStatusLabel, isApiLimitedError } from "@/lib/stream-status";

interface StreamSlotProps {
  index: number;
  streamer: LiveStreamer | null;
  isSelected: boolean;
  onSelect: () => void;
  onClear: () => void;
}

function buildEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    playsinline: "1",
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export default function StreamSlot({
  index,
  streamer,
  isSelected,
  onSelect,
  onClear,
}: StreamSlotProps) {
  const hasVideo = Boolean(streamer?.videoId);
  const hasChannel =
    Boolean(streamer?.channelUrl) && streamer?.channelUrl !== "#";
  const isApiLimited =
    streamer?.status === "UNKNOWN" && isApiLimitedError(streamer.errorMessage);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`group relative aspect-video w-full min-w-0 overflow-hidden border bg-black transition-all ${
        isSelected
          ? "border-blue-500 ring-1 ring-blue-500/40"
          : hasVideo
            ? "border-blue-900/40 hover:border-blue-700/60"
            : "border-white/10 hover:border-white/20"
      }`}
    >
      {!streamer && (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
          <span className="text-xl font-light text-zinc-700">+</span>
          <span className="max-w-[120px] font-mono text-[9px] uppercase tracking-wider text-zinc-600">
            Slot {index + 1}
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
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-8">
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-white sm:text-xs">
              {streamer.name}
            </p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            className="absolute right-1.5 top-1.5 z-10 border border-white/10 bg-black/70 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-zinc-400 opacity-0 transition-opacity hover:border-blue-600/40 hover:text-blue-300 group-hover:opacity-100 sm:opacity-100"
          >
            Clear
          </button>
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
  );
}
