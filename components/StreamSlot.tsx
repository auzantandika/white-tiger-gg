import type { LiveStreamer } from "@/lib/types";
import { getStreamerStatusLabel } from "@/lib/stream-status";

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
      className={`relative flex aspect-video w-full min-w-0 flex-col overflow-hidden border bg-black transition-all ${
        isSelected
          ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.35)] ring-1 ring-blue-500/50"
          : hasVideo
            ? "border-blue-800/50 shadow-[0_0_14px_rgba(37,99,235,0.2)]"
            : "border-white/10 hover:border-white/20"
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/5 bg-zinc-950/80 px-2 py-1">
        <span className="truncate font-mono text-[9px] uppercase tracking-widest text-zinc-500">
          {streamer ? streamer.name : `Slot ${index + 1}`}
        </span>
        {streamer && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            className="min-h-9 shrink-0 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-blue-400"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        {!streamer && (
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-2xl font-light text-zinc-600">+</span>
            <span className="max-w-[140px] font-mono text-[9px] uppercase leading-relaxed tracking-wider text-zinc-600">
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
            <span className="absolute bottom-1 right-1 z-10 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-zinc-500">
              Muted autoplay
            </span>
          </>
        )}

        {streamer && !hasVideo && (
          <div className="flex flex-col items-center gap-3 px-4 text-center">
            <span
              className={`font-mono text-[10px] uppercase tracking-widest ${
                streamer.status === "UNKNOWN"
                  ? "text-amber-500/80"
                  : "text-zinc-500"
              }`}
            >
              {streamer.status === "UNKNOWN"
                ? getStreamerStatusLabel(streamer)
                : streamer.status}
            </span>
            <p className="text-sm font-semibold text-white">{streamer.name}</p>
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
              {streamer.status === "UNKNOWN" ? "Status pending scan" : "Stream offline"}
            </p>
            {hasChannel && (
              <a
                href={streamer.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-blue-600/40 hover:text-blue-300"
              >
                Open Channel
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
