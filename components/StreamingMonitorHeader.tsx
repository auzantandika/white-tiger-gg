import Image from "next/image";

interface StreamingMonitorHeaderProps {
  liveCount: number;
  totalChannels: number;
  refreshSeconds?: number;
}

export default function StreamingMonitorHeader({
  liveCount,
  totalChannels,
  refreshSeconds = 300,
}: StreamingMonitorHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-white/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Image
          src="/logo/white-tiger-logo.png"
          alt="White Tiger logo"
          width={64}
          height={64}
          unoptimized
          className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
        />
        <div className="min-w-0">
          <h2 className="truncate font-mono text-sm font-bold uppercase tracking-[0.12em] text-white sm:text-base">
            WHITE TIGER{" "}
            <span className="text-blue-500">GG</span>
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-400/80">
            Live Streaming Monitor
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-widest">
        <span className="text-blue-400">
          Live Now: <span className="text-white">{liveCount}</span>
        </span>
        <span className="text-zinc-500">
          Total Channels: <span className="text-zinc-300">{totalChannels}</span>
        </span>
        <span className="text-zinc-600">
          Refresh: <span className="text-zinc-400">{refreshSeconds}s</span>
        </span>
      </div>
    </header>
  );
}
