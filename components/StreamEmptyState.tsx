interface StreamEmptyStateProps {
  variant: "no-live" | "scanning";
}

export default function StreamEmptyState({ variant }: StreamEmptyStateProps) {
  if (variant === "scanning") {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center border border-white/10 bg-black/60 px-6 py-16 text-center sm:min-h-[360px]">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-800/30 border-t-blue-500" />
        <p className="font-mono text-lg font-semibold uppercase tracking-[0.2em] text-zinc-300">
          Scanning Channels...
        </p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          {"// Full list may take several minutes to update"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center border border-white/10 bg-black/60 px-6 py-16 text-center sm:min-h-[360px]">
      <p className="font-mono text-2xl font-bold uppercase tracking-[0.25em] text-zinc-400">
        No Live
      </p>
      <p className="mt-2 font-mono text-sm uppercase tracking-[0.15em] text-zinc-500">
        Tidak ada yang live
      </p>
      <p className="mt-4 max-w-sm font-mono text-[10px] uppercase leading-relaxed tracking-widest text-zinc-600">
        {"// Semua channel sedang offline atau belum terdeteksi"}
      </p>
    </div>
  );
}
