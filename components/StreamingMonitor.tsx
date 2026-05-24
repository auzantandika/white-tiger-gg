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
import FocusedStreamView from "./FocusedStreamView";
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

function isLargeLayout(layout: GridLayout, slotCount: number): boolean {
  if (layout === "1x1") {
    return true;
  }
  if (layout === "2x1" && slotCount <= 2) {
    return true;
  }
  return false;
}

export default function StreamingMonitor() {
  const [hasUserSelectedLayout, setHasUserSelectedLayout] = useState(false);
  const [userLayout, setUserLayout] = useState<GridLayout>("ALL");
  const [assignmentOverrides, setAssignmentOverrides] = useState<
    (string | null)[] | null
  >(null);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [focusedStreamId, setFocusedStreamId] = useState<string | null>(null);
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

  const focusedStreamer = useMemo(() => {
    if (!focusedStreamId) {
      return null;
    }
    const streamer = streamerMap.get(focusedStreamId);
    if (!streamer?.videoId) {
      return null;
    }
    return streamer;
  }, [focusedStreamId, streamerMap]);

  useEffect(() => {
    if (focusedStreamId && !focusedStreamer) {
      setFocusedStreamId(null);
    }
  }, [focusedStreamId, focusedStreamer]);

  const gridCols = useMemo(() => {
    if (layout === "ALL") {
      return getAllLayoutCols(slotCount);
    }
    return FIXED_LAYOUT_SLOTS[layout].cols;
  }, [layout, slotCount]);

  const largeSlots = isLargeLayout(layout, slotCount);

  const handleLayoutChange = useCallback(
    (nextLayout: GridLayout) => {
      setHasUserSelectedLayout(true);
      setUserLayout(nextLayout);
      setFocusedStreamId(null);

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
        if (focusedStreamId === clearedId) {
          setFocusedStreamId(null);
        }
      }

      setAssignmentOverrides((current) => {
        const next = [...resizeAssignments(current ?? assignments, slotCount)];
        next[index] = null;
        return next;
      });
    },
    [assignments, slotCount, focusedStreamId],
  );

  const handleFocusStream = useCallback((streamerId: string) => {
    setFocusedStreamId(streamerId);
  }, []);

  const handleExitFocus = useCallback(() => {
    setFocusedStreamId(null);
  }, []);

  const liveCount = liveIds.length;
  const showScanning = loading && streamers.length === 0;
  const showNoLive = !loading && !error && liveCount === 0;
  const showGrid = !showScanning && !showNoLive && !focusedStreamer;

  return (
    <section
      aria-label="Streaming monitor"
      className="monitor-panel flex min-w-0 flex-col overflow-hidden rounded border border-white/10 bg-black/80"
    >
      <div className="px-2 pt-2 sm:px-3 sm:pt-3">
        <StreamingMonitorHeader
          liveCount={liveCount}
          totalChannels={streamers.length}
          refreshSeconds={REFRESH_SECONDS}
        />
      </div>

      {!focusedStreamer && (
        <div className="mt-2 flex min-w-0 items-center gap-2 border-y border-white/10 bg-black/50 px-2 py-1.5 sm:px-3">
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
      )}

      {error && (
        <div className="mx-2 mt-2 border border-blue-900/40 bg-blue-950/20 px-3 py-2 sm:mx-3">
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

      <div className="flex min-w-0 flex-col gap-2 p-2 sm:gap-3 sm:p-3 lg:flex-row">
        <div className="min-w-0 flex-1">
          {showScanning && <StreamEmptyState variant="scanning" />}
          {showNoLive && <StreamEmptyState variant="no-live" />}
          {focusedStreamer && (
            <FocusedStreamView
              streamer={focusedStreamer}
              onBack={handleExitFocus}
            />
          )}
          {showGrid && (
            <div className={`grid min-w-0 gap-1 sm:gap-1.5 ${gridCols}`}>
              {assignments.map((streamerId, index) => (
                <StreamSlot
                  key={`slot-${index}`}
                  streamer={
                    streamerId ? (streamerMap.get(streamerId) ?? null) : null
                  }
                  isSelected={selectedSlot === index}
                  isLarge={largeSlots}
                  onSelect={() => {
                    setSelectedSlot(index);
                    if (
                      streamerId &&
                      streamerMap.get(streamerId)?.videoId
                    ) {
                      handleFocusStream(streamerId);
                    }
                  }}
                  onClear={() => handleClearSlot(index)}
                  onFocus={
                    streamerId
                      ? () => handleFocusStream(streamerId)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>

        {!focusedStreamer && (
          <StreamerSidebar
            streamers={streamers}
            loading={loading}
            error={error}
            onAssignStreamer={handleAssignStreamer}
            onRetry={() => fetchLiveStatus(true)}
          />
        )}
      </div>

      {!error && (
        <div className="px-2 pb-2 sm:px-3 sm:pb-3">
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
