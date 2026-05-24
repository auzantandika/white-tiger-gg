import type { TabId } from "@/lib/types";

interface TabButtonProps {
  id: TabId;
  label: string;
  active: boolean;
  onClick: (id: TabId) => void;
}

export default function TabButton({
  id,
  label,
  active,
  onClick,
}: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`relative min-h-11 flex-1 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] transition-all duration-300 sm:text-xs sm:tracking-[0.2em] ${
        active
          ? "border border-blue-700/60 bg-blue-950/30 text-white shadow-[0_0_20px_rgba(37,99,235,0.25)]"
          : "border border-white/10 bg-black/40 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
      }`}
    >
      {label}
      {active && (
        <span className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
      )}
    </button>
  );
}
