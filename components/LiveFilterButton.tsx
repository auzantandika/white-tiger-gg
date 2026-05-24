import type { LiveFilterMode } from "@/lib/stream-live-filter";

interface LiveFilterButtonProps {
  mode: LiveFilterMode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function LiveFilterButton({
  mode,
  label,
  active,
  onClick,
}: LiveFilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-mode={mode}
      className={`shrink-0 border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest transition-colors sm:px-3 sm:text-[10px] ${
        active
          ? "border-blue-500/70 bg-blue-950/60 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
          : "border-white/10 bg-black/50 text-zinc-500 hover:border-blue-800/50 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}
