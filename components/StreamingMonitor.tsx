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
  suggestLayoutForLiveCount,
  syncLiveAssignments,
} from "@/lib/stream-layout";
import type { GridLayout, LiveStreamer, YoutubeLiveResponse } from "@/lib/types";
import LayoutButton from "./LayoutButton";
import StreamerSidebar from "./StreamerSidebar";
import StreamSlot from "./StreamSlot";

const REFRESH_INTERVAL_MS = 60_000;

function getLiveStreamerIds(streamers: LiveStreamer[]): string[] {
  return streamers
    .filter((streamer) => streamer.status === "LIVE" && streamer.videoId)
    .map((streamer) => streamer.id);
}

export default function StreamingMonitor() {
  const [hasUserSelectedLayout, setHasUserSelectedLayout] = useState(false);
  const [userLayout, setUserLayout] = useState<GridLayout>("2x2");
  const [assignmentOverrides, setAssignmentOverrides] = useState<
    (string | null)[] | null
  >(null);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [streamers, setStreamers] = useState<LiveStreamer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [manuallyClearedIds, setManuallyClearedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const fetchLiveStatus = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      const response = await fetch("/api/youtube-live");
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to fetch live status");
      }

      const data = (await response.json()) as YoutubeLiveResponse;
      setStreamers(data.streamers);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to retrieve YouTube live status",
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

  const layout = hasUserSelectedLayout
    ? userLayout
    : suggestLayoutForLiveCount(liveIds.length);

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

  return (
    <section aria-label="Streaming monitor" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1 border-b border-white/5 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-blue-400/70">
            {"// STREAM NETWORK"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Multi-stream live monitor
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            {slotCount} active slots
          </p>
          {!loading && !error && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-blue-400/70">
              {liveCount} live now
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded border border-blue-900/50 bg-blue-950/20 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-blue-400">
            Live Status Error
          </p>
          <p className="mt-1 text-sm text-zinc-400">{error}</p>
          <button
            type="button"
            onClick={() => fetchLiveStatus(true)}
            className="mt-2 min-h-10 border border-blue-800/40 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-blue-300 transition-colors hover:bg-blue-950/40"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex min-w-0 items-center gap-2 border border-white/10 bg-black/50 p-2">
            <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-zinc-600">
              Layout
            </span>
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {LAYOUT_OPTIONS.map((option) => (
                <LayoutButton
                  key={option}
                  label={option}
                  active={layout === option}
                  onClick={() => handleLayoutChange(option)}
                />
              ))}
            </div>
          </div>

          <div className={`grid min-w-0 gap-2 ${gridCols}`}>
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
        </div>

        <StreamerSidebar
          streamers={streamers}
          loading={loading}
          error={error}
          onAssignStreamer={handleAssignStreamer}
          onRetry={() => fetchLiveStatus(true)}
        />
      </div>

      <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-700">
        Live streams auto-load · status refreshes every 60 seconds
      </p>
    </section>
  );
}
