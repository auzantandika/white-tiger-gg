interface StreamEmptyStateProps {
  variant: "no-live" | "scanning" | "pending-scan";
  message?: string;
}

export default function StreamEmptyState({
  variant,
  message,
}: StreamEmptyStateProps) {
  if (variant === "scanning") {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center border border-white/10 bg-black/60 px-6 py-16 text-center sm:min-h-[420px] lg:min-h-[480px]">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-800/30 border-t-blue-500" />
        <p className="font-mono text-lg font-semibold uppercase tracking-[0.15em] text-zinc-300">
          Loading live data...
        </p>
      </div>
    );
  }

  if (variant === "pending-scan") {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center border border-white/10 bg-black/60 px-6 py-16 text-center sm:min-h-[420px] lg:min-h-[480px]">
        <p className="font-mono text-lg font-semibold uppercase tracking-[0.15em] text-zinc-300">
          Waiting for first scan
        </p>
        <p className="mt-4 max-w-md font-mono text-[10px] uppercase leading-relaxed tracking-widest text-zinc-600">
          {message ??
            "Live data has not been scanned yet. The scheduled scan will update shortly."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center border border-white/10 bg-black/60 px-6 py-16 text-center sm:min-h-[420px] lg:min-h-[480px]">
      <p className="font-mono text-xl font-bold uppercase tracking-[0.2em] text-zinc-400 sm:text-2xl">
        No live streams detected.
      </p>
      <p className="mt-4 max-w-md font-mono text-[10px] uppercase leading-relaxed tracking-widest text-zinc-600">
        All channels are offline or not yet detected.
      </p>
    </div>
  );
}
