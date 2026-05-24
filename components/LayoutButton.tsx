interface LayoutButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function LayoutButton({
  label,
  active,
  onClick,
}: LayoutButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 shrink-0 border px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-all ${
        active
          ? "border-blue-500/60 bg-blue-950/50 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.25)]"
          : "border-white/10 bg-black/40 text-zinc-500 hover:border-blue-800/40 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}
