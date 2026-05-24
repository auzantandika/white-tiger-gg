"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assignStreamerToSlot,
  buildInitialAssignments,
  FIXED_LAYOUT_SLOTS,
  getAllLayoutCols,
  getSlotCountForLayout,
  LAYOUT_OPTIONS,
  resizeAssignments,
  syncLiveAssignments,
} from "@/lib/stream-layout";
import type { GridLayout, LiveStreamer, YoutubeLiveResponse } from "@/lib/types";
import LayoutButton from "./LayoutButton";
import StreamEmptyState from "./StreamEmptyState";
import StreamRefreshBar from "./StreamRefreshBar";
import StreamerSidebar from "./StreamerSidebar";
import StreamingMonitorHeader from "./StreamingMonitorHeader";
import StreamSlot from "./StreamSlot";

const REFRESH_INTERVAL_MS = 300_000;
const REFRESH_SECONDS = 300;

function getLiveStreamerIds(streamers: LiveStreamer[]): string[] {
  return streamers
    .filter((streamer) => streamer.status === "LIVE" && streamer.videoId)
    .map((streamer) => streamer.id);
}

export default function StreamingMonitor() {
  const [hasUserSelectedLayout, setHasUserSelectedLayout] = useState(false);
  const [userLayout, setUserLayout] = useState<GridLayout>("ALL");
  const [assignmentOverrides, setAssignmentOverrides] = useState<
    (string | null)[] | null
  >(null);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [streamers, setStreamers] = useState<LiveStreamer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState<number | null>(null);
  const [scanBatchSize, setScanBatchSize] = useState(47);

  const [manuallyClearedIds, setManuallyClearedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const fetchLiveStatus = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      const response = await fetch("/api/youtube-live");
      if (!response.ok) {
        throw new Error(
          "Live detection unavailable. Please check YouTube API key or quota.",
        );
      }

      const data = (await response.json()) as YoutubeLiveResponse;
      setStreamers(data.streamers);
      setLastCheckedAt(data.lastCheckedAt ?? null);
      setScannedCount(data.scannedCount ?? null);
      setScanBatchSize(data.scanBatchSize ?? 47);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Live detection unavailable. Please check YouTube API key or quota.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchLiveStatus(true);
    }, 0);

    const interval = window.setInterval(
      () => void fetchLiveStatus(false),
      REFRESH_INTERVAL_MS,
    );

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(interval);
    };
  }, [fetchLiveStatus]);

  const liveIds = useMemo(() => getLiveStreamerIds(streamers), [streamers]);

  const layout = hasUserSelectedLayout ? userLayout : "ALL";

  const slotCount = useMemo(
    () => getSlotCountForLayout(layout, liveIds),
    [layout, liveIds],
  );

  const activeSkipIds = useMemo(() => {
    const liveIdSet = new Set(liveIds);
    return new Set(
      [...manuallyClearedIds].filter((id) => liveIdSet.has(id)),
    );
  }, [manuallyClearedIds, liveIds]);

  const assignments = useMemo(() => {
    const base = assignmentOverrides ?? buildInitialAssignments(slotCount);

    return syncLiveAssignments(
      resizeAssignments(base, slotCount),
      slotCount,
      liveIds,
      activeSkipIds,
    );
  }, [assignmentOverrides, slotCount, liveIds, activeSkipIds]);

  const streamerMap = useMemo(
    () => new Map(streamers.map((streamer) => [streamer.id, streamer])),
    [streamers],
  );

  const gridCols = useMemo(() => {
    if (layout === "ALL") {
      return getAllLayoutCols(slotCount);
    }
    return FIXED_LAYOUT_SLOTS[layout].cols;
  }, [layout, slotCount]);

  const handleLayoutChange = useCallback(
    (nextLayout: GridLayout) => {
      setHasUserSelectedLayout(true);
      setUserLayout(nextLayout);

      const count = getSlotCountForLayout(nextLayout, liveIds);

      setAssignmentOverrides((current) =>
        syncLiveAssignments(
          resizeAssignments(current ?? assignments, count),
          count,
          liveIds,
          activeSkipIds,
        ),
      );
      setSelectedSlot(0);
    },
    [assignments, liveIds, activeSkipIds],
  );

  const handleAssignStreamer = useCallback(
    (streamerId: string) => {
      setManuallyClearedIds((prev) => {
        const next = new Set(prev);
        next.delete(streamerId);
        return next;
      });

      setAssignmentOverrides((current) =>
        assignStreamerToSlot(
          current ?? assignments,
          slotCount,
          streamerId,
          selectedSlot,
        ),
      );
    },
    [assignments, selectedSlot, slotCount],
  );

  const handleClearSlot = useCallback(
    (index: number) => {
      const clearedId = assignments[index];

      if (clearedId) {
        setManuallyClearedIds((prev) => new Set(prev).add(clearedId));
      }

      setAssignmentOverrides((current) => {
        const next = [...resizeAssignments(current ?? assignments, slotCount)];
        next[index] = null;
        return next;
      });
    },
    [assignments, slotCount],
  );

  const liveCount = liveIds.length;
  const showScanning = loading && streamers.length === 0;
  const showNoLive = !loading && !error && liveCount === 0;
  const showGrid = !showScanning && !showNoLive;

  return (
    <section
      aria-label="Streaming monitor"
      className="monitor-panel flex min-w-0 flex-col overflow-hidden rounded border border-white/10 bg-black/80"
    >
      <div className="px-3 pt-3 sm:px-4 sm:pt-4">
        <StreamingMonitorHeader
          liveCount={liveCount}
          totalChannels={streamers.length}
          refreshSeconds={REFRESH_SECONDS}
        />
      </div>

      <div className="mt-3 flex min-w-0 items-center gap-2 border-y border-white/10 bg-black/50 px-2 py-2 sm:px-3">
        <span className="hidden shrink-0 font-mono text-[9px] uppercase tracking-widest text-zinc-600 sm:inline">
          Layout
        </span>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LAYOUT_OPTIONS.map((option) => (
            <LayoutButton
              key={option}
              layout={option}
              active={layout === option}
              onClick={() => handleLayoutChange(option)}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-3 mt-3 border border-blue-900/40 bg-blue-950/20 px-3 py-2 sm:mx-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-blue-400">
            Live Status Error
          </p>
          <p className="mt-1 text-xs text-zinc-400">{error}</p>
          <button
            type="button"
            onClick={() => fetchLiveStatus(true)}
            className="mt-2 min-h-9 border border-blue-800/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-blue-300 hover:bg-blue-950/40"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-3 p-3 sm:p-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          {showScanning && <StreamEmptyState variant="scanning" />}
          {showNoLive && <StreamEmptyState variant="no-live" />}
          {showGrid && (
            <div className={`grid min-w-0 gap-1.5 sm:gap-2 ${gridCols}`}>
              {assignments.map((streamerId, index) => (
                <StreamSlot
                  key={`slot-${index}`}
                  index={index}
                  streamer={
                    streamerId ? (streamerMap.get(streamerId) ?? null) : null
                  }
                  isSelected={selectedSlot === index}
                  onSelect={() => setSelectedSlot(index)}
                  onClear={() => handleClearSlot(index)}
                />
              ))}
            </div>
          )}
        </div>

        <StreamerSidebar
          streamers={streamers}
          loading={loading}
          error={error}
          onAssignStreamer={handleAssignStreamer}
          onRetry={() => fetchLiveStatus(true)}
        />
      </div>

      {!error && (
        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          <StreamRefreshBar
            lastCheckedAt={lastCheckedAt}
            scannedCount={scannedCount}
            scanBatchSize={scanBatchSize}
            refreshSeconds={REFRESH_SECONDS}
          />
        </div>
      )}
    </section>
  );
}
