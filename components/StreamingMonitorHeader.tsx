import { formatLastChecked } from "@/lib/stream-status";
import Image from "next/image";

interface StreamingMonitorHeaderProps {
  liveCount: number;
  totalChannels: number;
  refreshCountdown: number;
  lastCheckedAt?: string | null;
  scannedCount?: number | null;
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  showSidebarToggle?: boolean;
}

function ControlBox({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="flex min-h-10 min-w-0 flex-col justify-center border border-white/10 bg-black/60 px-2.5 py-1.5 sm:min-h-11 sm:px-3">
      <span className="font-mono text-[8px] uppercase tracking-widest text-zinc-600 sm:text-[9px]">
        {label}
      </span>
      <span
        className={`font-mono text-xs font-semibold tabular-nums sm:text-sm ${
          accent ? "text-blue-400" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function StreamingMonitorHeader({
  liveCount,
  totalChannels,
  refreshCountdown,
  lastCheckedAt = null,
  scannedCount = null,
  sidebarVisible,
  onToggleSidebar,
  showSidebarToggle = true,
}: StreamingMonitorHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-white/10 pb-3">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-600">
              Total Channels: {totalChannels}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-stretch gap-1.5 sm:justify-end">
          <ControlBox label="Live Now" value={liveCount} accent />
          <ControlBox
            label="Refresh in"
            value={`${refreshCountdown}s`}
          />
          {showSidebarToggle && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-pressed={sidebarVisible}
              className="flex min-h-10 min-w-[7.5rem] flex-col justify-center border border-blue-800/40 bg-blue-950/30 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest text-blue-300 transition-colors hover:border-blue-600/50 hover:bg-blue-950/50 sm:min-h-11 sm:min-w-[8.5rem] sm:px-3 sm:text-[10px]"
            >
              {sidebarVisible ? "Hide List" : "Show List"}
            </button>
          )}
        </div>
      </div>

      <p className="font-mono text-[8px] uppercase tracking-widest text-zinc-700 sm:text-right">
        Last checked {formatLastChecked(lastCheckedAt)}
        {scannedCount !== null && (
          <span className="text-zinc-800">
            {" · "}
            {scannedCount} checked this cycle
          </span>
        )}
      </p>
    </header>
  );
}
