"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  enrichStreamersWithTags,
  getLiveStreamerIds,
  getLiveStreamers,
  getTaggedLiveStreamers,
  hasPendingLiveChecks,
  type LiveFilterMode,
} from "@/lib/stream-live-filter";
import type { GridLayout, LiveStreamer, YoutubeLiveResponse } from "@/lib/types";
import FocusedStreamView from "./FocusedStreamView";
import LayoutButton from "./LayoutButton";
import LiveFilterButton from "./LiveFilterButton";
import StreamEmptyState from "./StreamEmptyState";
import StreamingMonitorFooter from "./StreamingMonitorFooter";
import StreamerSidebar from "./StreamerSidebar";
import StreamingMonitorHeader from "./StreamingMonitorHeader";
import StreamSlot from "./StreamSlot";

const REFRESH_SECONDS = 300;

function isLargeLayout(
  layout: GridLayout,
  slotCount: number,
  streamAreaExpanded: boolean,
): boolean {
  if (layout === "1x1") {
    return true;
  }
  if (layout === "2x1" && slotCount <= 2) {
    return true;
  }
  if (streamAreaExpanded && layout === "ALL" && slotCount <= 2) {
    return true;
  }
  return false;
}

export default function StreamingMonitor() {
  const [hasUserSelectedLayout, setHasUserSelectedLayout] = useState(false);
  const [userLayout, setUserLayout] = useState<GridLayout>("ALL");
  const [liveFilterMode, setLiveFilterMode] =
    useState<LiveFilterMode>("all-live");
  const [assignmentOverrides, setAssignmentOverrides] = useState<
    (string | null)[] | null
  >(null);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [focusedStreamId, setFocusedStreamId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_SECONDS);
  const [streamers, setStreamers] = useState<LiveStreamer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState<number | null>(null);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

  const [manuallyClearedIds, setManuallyClearedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const fetchInFlightRef = useRef(false);

  const fetchLiveStatus = useCallback(async (showLoading = false) => {
    if (fetchInFlightRef.current) {
      return;
    }

    fetchInFlightRef.current = true;
    if (showLoading) setLoading(true);

    try {
      const response = await fetch("/api/youtube-live");
      if (!response.ok) {
        throw new Error(
          "Live detection unavailable. Please check YouTube API key or quota.",
        );
      }

      const data = (await response.json()) as YoutubeLiveResponse;
      setStreamers(enrichStreamersWithTags(data.streamers));
      setLastCheckedAt(data.lastCheckedAt ?? null);
      setScannedCount(data.scannedCount ?? null);
      setError(null);
      setHasFetchedOnce(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Live detection unavailable. Please check YouTube API key or quota.",
      );
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  const resetRefreshCountdown = useCallback(() => {
    setRefreshCountdown(REFRESH_SECONDS);
  }, []);

  const refreshLiveStatus = useCallback(
    async (showLoading = false) => {
      await fetchLiveStatus(showLoading);
      resetRefreshCountdown();
    },
    [fetchLiveStatus, resetRefreshCountdown],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshLiveStatus(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshLiveStatus]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshCountdown((previous) => {
        if (previous <= 1) {
          void fetchLiveStatus(false);
          return REFRESH_SECONDS;
        }
        return previous - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchLiveStatus]);

  const enrichedStreamers = useMemo(
    () => enrichStreamersWithTags(streamers),
    [streamers],
  );

  const liveStreamers = useMemo(
    () => getLiveStreamers(enrichedStreamers),
    [enrichedStreamers],
  );

  const taggedLiveStreamers = useMemo(
    () => getTaggedLiveStreamers(enrichedStreamers),
    [enrichedStreamers],
  );

  const liveIds = useMemo(
    () => getLiveStreamerIds(enrichedStreamers, liveFilterMode),
    [enrichedStreamers, liveFilterMode],
  );

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
    () => new Map(enrichedStreamers.map((streamer) => [streamer.id, streamer])),
    [enrichedStreamers],
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

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    console.debug("[StreamingMonitor]", {
      totalStreamers: enrichedStreamers.length,
      liveStreamers: liveStreamers.length,
      taggedLiveStreamers: taggedLiveStreamers.length,
      activeFilter: liveFilterMode,
      selectedLayout: layout,
      hasPendingChecks: hasPendingLiveChecks(enrichedStreamers),
    });
  }, [
    enrichedStreamers,
    liveStreamers.length,
    taggedLiveStreamers.length,
    liveFilterMode,
    layout,
  ]);

  const gridCols = useMemo(() => {
    if (layout === "ALL") {
      return getAllLayoutCols(slotCount);
    }
    return FIXED_LAYOUT_SLOTS[layout].cols;
  }, [layout, slotCount]);

  const streamAreaExpanded = !sidebarVisible;
  const largeSlots = isLargeLayout(layout, slotCount, streamAreaExpanded);

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

  const handleToggleSidebar = useCallback(() => {
    setSidebarVisible((visible) => !visible);
  }, []);

  const hasApiResponse = hasFetchedOnce && enrichedStreamers.length > 0;
  const pendingChecks = hasPendingLiveChecks(enrichedStreamers);
  const liveCount =
    liveFilterMode === "tagged-only"
      ? taggedLiveStreamers.length
      : liveStreamers.length;

  const showScanning =
    !error &&
    (loading && enrichedStreamers.length === 0 ||
      !hasApiResponse ||
      (liveFilterMode === "all-live" &&
        liveStreamers.length === 0 &&
        pendingChecks) ||
      (liveFilterMode === "tagged-only" &&
        taggedLiveStreamers.length === 0 &&
        liveStreamers.length === 0 &&
        pendingChecks));

  const showNoLive =
    !loading &&
    !error &&
    hasApiResponse &&
    liveFilterMode === "all-live" &&
    liveStreamers.length === 0 &&
    !pendingChecks;

  const showNoTaggedLive =
    !loading &&
    !error &&
    hasApiResponse &&
    liveFilterMode === "tagged-only" &&
    taggedLiveStreamers.length === 0 &&
    (liveStreamers.length > 0 || !pendingChecks);

  const showGrid =
    !showScanning &&
    !showNoLive &&
    !showNoTaggedLive &&
    !focusedStreamer &&
    liveIds.length > 0;

  const showSidebar = sidebarVisible;

  return (
    <section
      aria-label="Streaming monitor"
      className="monitor-panel flex min-w-0 flex-col overflow-hidden rounded border border-white/10 bg-black/80"
    >
      <div className="px-2 pt-2 sm:px-3 sm:pt-3">
        <StreamingMonitorHeader
          liveCount={liveCount}
          totalChannels={enrichedStreamers.length}
          refreshCountdown={refreshCountdown}
          lastCheckedAt={lastCheckedAt}
          scannedCount={scannedCount}
          sidebarVisible={sidebarVisible}
          onToggleSidebar={handleToggleSidebar}
        />
      </div>

      {!focusedStreamer && (
        <div className="mt-2 flex min-w-0 flex-col gap-2 border-y border-white/10 bg-black/50 px-2 py-1.5 sm:px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden shrink-0 font-mono text-[9px] uppercase tracking-widest text-zinc-600 sm:inline">
              Filter
            </span>
            <div className="flex min-w-0 gap-1">
              <LiveFilterButton
                mode="all-live"
                label="All Live"
                active={liveFilterMode === "all-live"}
                onClick={() => setLiveFilterMode("all-live")}
              />
              <LiveFilterButton
                mode="tagged-only"
                label="Tagged Only"
                active={liveFilterMode === "tagged-only"}
                onClick={() => setLiveFilterMode("tagged-only")}
              />
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
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
            onClick={() => void refreshLiveStatus(true)}
            className="mt-2 min-h-9 border border-blue-800/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-blue-300 hover:bg-blue-950/40"
          >
            Retry
          </button>
        </div>
      )}

      <div
        className={`monitor-content-grid gap-2 p-2 sm:gap-3 sm:p-3 ${
          showSidebar
            ? "monitor-content-grid--with-sidebar"
            : "monitor-content-grid--expanded"
        }`}
      >
        <div className="stream-stage min-w-0">
          {showScanning && <StreamEmptyState variant="scanning" />}
          {showNoLive && <StreamEmptyState variant="no-live" />}
          {showNoTaggedLive && (
            <StreamEmptyState variant="no-tagged-live" />
          )}
          {focusedStreamer && (
            <FocusedStreamView
              streamer={focusedStreamer}
              onBack={handleExitFocus}
              isExpanded={streamAreaExpanded}
              withSidebar={showSidebar}
            />
          )}
          {showGrid && (
            <div
              className={`grid min-w-0 gap-1 transition-[gap] duration-300 ease-in-out sm:gap-1.5 ${
                streamAreaExpanded ? "sm:gap-2" : ""
              } ${gridCols} ${
                layout === "1x1" && streamAreaExpanded
                  ? "mx-auto w-full max-w-none"
                  : ""
              }`}
            >
              {assignments.map((streamerId, index) => (
                <StreamSlot
                  key={`slot-${index}`}
                  streamer={
                    streamerId ? (streamerMap.get(streamerId) ?? null) : null
                  }
                  isSelected={selectedSlot === index}
                  isLarge={largeSlots}
                  isExpanded={streamAreaExpanded}
                  layout={layout}
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

        <div
          className={`monitor-sidebar-slot ${
            showSidebar
              ? "monitor-sidebar-slot--visible"
              : "monitor-sidebar-slot--hidden"
          }`}
          aria-hidden={!showSidebar}
        >
          {showSidebar && (
            <StreamerSidebar
              streamers={enrichedStreamers}
              loading={loading}
              error={error}
              liveFilterMode={liveFilterMode}
              onAssignStreamer={handleAssignStreamer}
              onRetry={() => void refreshLiveStatus(true)}
            />
          )}
        </div>
      </div>

      <StreamingMonitorFooter />
    </section>
  );
}
