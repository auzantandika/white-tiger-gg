import type { GridLayout } from "@/lib/types";

interface LayoutButtonProps {
  layout: GridLayout;
  active: boolean;
  onClick: () => void;
}

function formatLayoutLabel(layout: GridLayout): string {
  if (layout === "ALL") {
    return "ALL";
  }

  return layout.replace("x", "×");
}

export default function LayoutButton({
  layout,
  active,
  onClick,
}: LayoutButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all sm:min-h-10 sm:px-3 ${
        active
          ? "border-blue-500/70 bg-blue-950/60 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
          : "border-white/10 bg-black/50 text-zinc-500 hover:border-blue-800/50 hover:text-zinc-300"
      }`}
    >
      {formatLayoutLabel(layout)}
    </button>
  );
}
