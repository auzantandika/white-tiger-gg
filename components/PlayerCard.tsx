import type { Player } from "@/lib/types";

interface PlayerCardProps {
  player: Player;
  serverId: string;
}

export default function PlayerCard({ player, serverId }: PlayerCardProps) {
  return (
    <article className="group relative overflow-hidden rounded border border-white/10 bg-zinc-950/80 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-800/40 hover:shadow-[0_0_24px_rgba(37,99,235,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-white">
            {player.name}
          </h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Server: {serverId}
          </p>
        </div>
        <span className="shrink-0 rounded border border-blue-500/30 bg-blue-950/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-blue-400">
          ONLINE
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          Ping
        </span>
        <span className="font-mono text-sm text-blue-400/90">{player.ping}ms</span>
      </div>
    </article>
  );
}
