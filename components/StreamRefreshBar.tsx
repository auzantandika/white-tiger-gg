import { formatLastChecked, formatScanBatchMessage } from "@/lib/stream-status";

interface StreamRefreshBarProps {
  lastCheckedAt: string | null;
  scannedCount: number | null;
  scanBatchSize: number;
  refreshSeconds?: number;
}

export default function StreamRefreshBar({
  lastCheckedAt,
  scannedCount,
  scanBatchSize,
  refreshSeconds = 300,
}: StreamRefreshBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 px-1 py-2 font-mono text-[9px] uppercase tracking-widest text-zinc-600">
      <span>Refresh every {refreshSeconds}s</span>
      <span className="text-zinc-700">·</span>
      <span>Last checked {formatLastChecked(lastCheckedAt)}</span>
      {scannedCount !== null && (
        <>
          <span className="text-zinc-700">·</span>
          <span>{scannedCount} checked this cycle</span>
        </>
      )}
      <span className="hidden text-zinc-700 sm:inline">·</span>
      <span className="hidden sm:inline">{formatScanBatchMessage(scanBatchSize)}</span>
      <span className="hidden text-zinc-700 md:inline">·</span>
      <span className="hidden md:inline">Full list may take several minutes to update.</span>
    </div>
  );
}
