import { NextResponse } from "next/server";
import { SERVER_ID } from "@/lib/constants";
import type { Player, PlayersResponse } from "@/lib/types";

const FIVEM_API = `https://servers-frontend.fivem.net/api/servers/single/${SERVER_ID}`;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FiveMPlayer {
  id: number;
  name: string;
  ping: number;
}

interface FiveMServerData {
  hostname?: string;
  clients?: number;
  sv_maxclients?: number;
  players?: FiveMPlayer[];
}

interface FiveMResponse {
  Data?: FiveMServerData;
}

function sanitizePlayers(players: FiveMPlayer[] | undefined): Player[] {
  if (!Array.isArray(players)) return [];

  return players.map((player) => ({
    id: player.id,
    name: player.name,
    ping: player.ping,
  }));
}

export async function GET() {
  try {
    const response = await fetch(FIVEM_API, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch server data" },
        { status: 502 },
      );
    }

    const data = (await response.json()) as FiveMResponse;
    const serverData = data.Data;

    if (!serverData) {
      return NextResponse.json(
        { error: "Invalid server response" },
        { status: 502 },
      );
    }

    const payload: PlayersResponse = {
      serverId: SERVER_ID,
      hostname: serverData.hostname ?? "Unknown Server",
      online: serverData.clients ?? 0,
      maxPlayers: serverData.sv_maxclients ?? 0,
      players: sanitizePlayers(serverData.players),
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach FiveM server list" },
      { status: 500 },
    );
  }
}
