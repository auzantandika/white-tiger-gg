"use client";

interface StreamPlayerActionsProps {
  videoId: string;
  onFullscreen: () => void;
  onBack?: () => void;
  onClear?: () => void;
  showBack?: boolean;
  showClear?: boolean;
  compact?: boolean;
}

export default function StreamPlayerActions({
  videoId,
  onFullscreen,
  onBack,
  onClear,
  showBack = false,
  showClear = false,
  compact = false,
}: StreamPlayerActionsProps) {
  const buttonClass = compact
    ? "min-h-8 border border-white/10 bg-black/75 px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-blue-600/50 hover:text-blue-300 sm:min-h-9 sm:px-2.5 sm:text-[9px]"
    : "min-h-9 border border-white/10 bg-black/75 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-blue-600/50 hover:text-blue-300 sm:min-h-10 sm:px-3 sm:text-[10px]";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showBack && onBack && (
        <button type="button" onClick={onBack} className={buttonClass}>
          Back
        </button>
      )}
      <button
        type="button"
        onClick={() =>
          window.open(
            `https://www.youtube.com/watch?v=${videoId}`,
            "_blank",
            "noopener,noreferrer",
          )
        }
        className={buttonClass}
      >
        Open in YouTube
      </button>
      <button type="button" onClick={onFullscreen} className={buttonClass}>
        Fullscreen
      </button>
      {showClear && onClear && (
        <button type="button" onClick={onClear} className={buttonClass}>
          Clear
        </button>
      )}
    </div>
  );
}
