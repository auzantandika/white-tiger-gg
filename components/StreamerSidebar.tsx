"use client";

import { useMemo, useState } from "react";
import type { LiveStreamer, SidebarFilter } from "@/lib/types";
import StreamerListItem from "./StreamerListItem";

interface StreamerSidebarProps {
  streamers: LiveStreamer[];
  loading: boolean;
  error: string | null;
  onAssignStreamer: (streamerId: string) => void;
  onRetry: () => void;
}

export default function StreamerSidebar({
  streamers,
  loading,
  error,
  onAssignStreamer,
  onRetry,
}: StreamerSidebarProps) {
  const [filter, setFilter] = useState<SidebarFilter>("LIVE");
  const [search, setSearch] = useState("");

  const liveCount = useMemo(
    () => streamers.filter((streamer) => streamer.status === "LIVE").length,
    [streamers],
  );

  const filteredStreamers = useMemo(() => {
    let list = streamers;

    if (filter === "LIVE") {
      list = list.filter((streamer) => streamer.status === "LIVE");
    }

    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter((streamer) =>
        streamer.name.toLowerCase().includes(query),
      );
    }

    return list;
  }, [filter, search, streamers]);

  return (
    <aside className="flex w-full min-w-0 shrink-0 flex-col border border-white/10 bg-black/70 lg:w-72 xl:w-80">
      <div className="flex border-b border-white/10">
        <button
          type="button"
          onClick={() => setFilter("LIVE")}
          className={`min-h-10 flex-1 px-2 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors sm:min-h-11 ${
            filter === "LIVE"
              ? "border-b border-blue-500 bg-blue-950/30 text-blue-300"
              : "text-zinc-600 hover:text-zinc-400"
          }`}
        >
          Live ({liveCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={`min-h-10 flex-1 px-2 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors sm:min-h-11 ${
            filter === "ALL"
              ? "border-b border-blue-500 bg-blue-950/30 text-blue-300"
              : "text-zinc-600 hover:text-zinc-400"
          }`}
        >
          Semua ({streamers.length})
        </button>
      </div>

      <div className="border-b border-white/10 p-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari streamer..."
          className="min-h-10 w-full border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-xs text-white placeholder:text-zinc-600 focus:border-blue-700/50 focus:outline-none"
        />
      </div>

      <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto p-2 sm:max-h-[400px] lg:max-h-none lg:flex-1">
        {loading && streamers.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-800/30 border-t-blue-500" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Scanning...
            </p>
          </div>
        )}

        {!loading && error && streamers.length === 0 && (
          <div className="py-6 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Unable to load streamers
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 min-h-10 border border-blue-800/40 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-blue-300 hover:bg-blue-950/40"
            >
              Retry
            </button>
          </div>
        )}

        {!loading &&
          filter === "LIVE" &&
          filteredStreamers.length === 0 &&
          streamers.length > 0 && (
            <p className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              {"// Belum ada yang live"}
            </p>
          )}

        {!loading &&
          filter === "ALL" &&
          filteredStreamers.length === 0 &&
          streamers.length > 0 && (
            <p className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              No streamers found
            </p>
          )}

        {filteredStreamers.map((streamer) => (
          <StreamerListItem
            key={streamer.id}
            streamer={streamer}
            onAssign={() => onAssignStreamer(streamer.id)}
          />
        ))}
      </div>
    </aside>
  );
}
