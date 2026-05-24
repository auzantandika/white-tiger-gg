import { getStreamerInitial } from "@/lib/streamers";
import { getStreamerStatusLabel, isApiLimitedError } from "@/lib/stream-status";
import type { LiveStreamer } from "@/lib/types";

interface StreamerListItemProps {
  streamer: LiveStreamer;
  onAssign: () => void;
}

export default function StreamerListItem({
  streamer,
  onAssign,
}: StreamerListItemProps) {
  const isLive = streamer.status === "LIVE";
  const isUnknown = streamer.status === "UNKNOWN";
  const isApiLimited = isUnknown && isApiLimitedError(streamer.errorMessage);
  const statusLabel = getStreamerStatusLabel(streamer);

  return (
    <div className="flex min-w-0 items-center gap-2 border border-white/5 bg-zinc-950/50 px-2 py-2 transition-colors hover:border-blue-800/30 hover:bg-zinc-950/80">
      {streamer.thumbnail ? (
        <img
          src={streamer.thumbnail}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full border border-blue-800/30 object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-800/30 bg-blue-950/30 font-mono text-[10px] font-semibold text-blue-300">
          {getStreamerInitial(streamer.name)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white sm:text-sm">
          {streamer.name}
        </p>
        <span
          className={`font-mono text-[8px] uppercase tracking-widest sm:text-[9px] ${
            isLive
              ? "text-blue-400"
              : isApiLimited
                ? "text-amber-500/80"
                : isUnknown
                  ? "text-zinc-500"
                  : "text-zinc-600"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <button
        type="button"
        onClick={onAssign}
        aria-label={`Assign ${streamer.name} to selected slot`}
        className="flex h-8 w-8 shrink-0 items-center justify-center border border-blue-800/40 bg-blue-950/20 font-mono text-xs text-blue-300 transition-colors hover:border-blue-500/50 hover:bg-blue-900/30 sm:h-9 sm:w-9"
      >
        +
      </button>
    </div>
  );
}
