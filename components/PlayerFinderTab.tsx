"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SERVER_ID } from "@/lib/constants";
import type { PlayersResponse } from "@/lib/types";
import PlayerCard from "./PlayerCard";

const REFRESH_INTERVAL_MS = 30_000;

export default function PlayerFinderTab() {
  const [data, setData] = useState<PlayersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchPlayers = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      const response = await fetch("/api/players");
      if (!response.ok) {
        throw new Error("Failed to load server data");
      }

      const payload = (await response.json()) as PlayersResponse;
      setData(payload);
      setError(null);
    } catch {
      setError("Unable to retrieve server data. The network may be offline.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchPlayers(true);
    }, 0);

    const interval = window.setInterval(
      () => void fetchPlayers(false),
      REFRESH_INTERVAL_MS,
    );

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(interval);
    };
  }, [fetchPlayers]);

  const filteredPlayers = useMemo(() => {
    if (!data) return [];

    const query = search.trim().toLowerCase();
    if (!query) return data.players;

    return data.players.filter(
      (player) =>
        player.name.toLowerCase().includes(query) ||
        data.serverId.toLowerCase().includes(query),
    );
  }, [data, search]);

  return (
    <section aria-label="Player Finder">
      <div className="mb-6 flex flex-col gap-4 border-b border-white/5 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-blue-400/70">
            {"// Player Finder"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Live roster from FiveM server {SERVER_ID}
          </p>
        </div>

        {data && !loading && !error && (
          <div className="rounded border border-white/10 bg-black/40 px-4 py-2 text-right">
            <p className="truncate font-mono text-xs uppercase tracking-widest text-zinc-500">
              {data.hostname}
            </p>
            <p className="mt-1 font-mono text-sm text-white">
              <span className="text-blue-500">{data.online}</span>
              <span className="text-zinc-600"> / </span>
              {data.maxPlayers}
              <span className="ml-2 text-[10px] uppercase tracking-widest text-zinc-600">
                online
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="mb-6">
        <label htmlFor="player-search" className="sr-only">
          Search players
        </label>
        <input
          id="player-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by player name or server ID..."
          className="w-full rounded border border-white/10 bg-zinc-950/80 px-4 py-3 font-mono text-sm text-white placeholder:text-zinc-600 focus:border-blue-800/50 focus:outline-none focus:ring-1 focus:ring-blue-800/30"
        />
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-800/30 border-t-blue-500" />
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            Scanning server roster...
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded border border-blue-900/50 bg-blue-950/20 px-6 py-10 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-blue-400">
            Connection Failed
          </p>
          <p className="mt-2 text-sm text-zinc-400">{error}</p>
          <button
            type="button"
            onClick={() => fetchPlayers(true)}
            className="mt-4 border border-blue-800/40 px-4 py-2 font-mono text-xs uppercase tracking-widest text-blue-300 transition-colors hover:bg-blue-950/40"
          >
            Retry Scan
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {filteredPlayers.length === 0 ? (
            <p className="py-12 text-center font-mono text-sm uppercase tracking-widest text-zinc-500">
              No online player found.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  serverId={data.serverId}
                />
              ))}
            </div>
          )}
        </>
      )}

      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-700">
        Auto-refresh every 30 seconds
      </p>
    </section>
  );
}
