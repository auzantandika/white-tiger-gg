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
  const [filter, setFilter] = useState<SidebarFilter>("ALL");
  const [search, setSearch] = useState("");

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
    <aside className="flex w-full shrink-0 flex-col border border-white/10 bg-black/60 lg:w-64 xl:w-72">
      <div className="flex border-b border-white/5">
        {(["LIVE", "ALL"] as SidebarFilter[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`flex-1 px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${
              filter === tab
                ? "border-b border-blue-500 bg-blue-950/20 text-blue-300"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="border-b border-white/5 p-2.5">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search streamers..."
          className="w-full border border-white/10 bg-zinc-950/80 px-2.5 py-2 font-mono text-xs text-white placeholder:text-zinc-600 focus:border-blue-800/50 focus:outline-none"
        />
      </div>

      <div className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto p-2.5 lg:max-h-none lg:flex-1">
        {loading && streamers.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-800/30 border-t-blue-500" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Scanning live channels...
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
              className="mt-3 border border-blue-800/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-blue-300 transition-colors hover:bg-blue-950/40"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && filteredStreamers.length === 0 && streamers.length > 0 && (
          <p className="py-6 text-center font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            {filter === "LIVE" ? "No live streamers" : "No streamers found"}
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
