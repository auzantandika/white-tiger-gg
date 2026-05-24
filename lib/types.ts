export type StreamStatus = "LIVE" | "OFFLINE";

export interface StreamerChannel {
  id: string;
  name: string;
  channelHandle: string;
  channelUrl: string;
}

export interface LiveStreamer {
  id: string;
  name: string;
  channelUrl: string;
  status: StreamStatus;
  videoId: string;
  title: string;
  thumbnail: string;
  channelHandle?: string;
  resolvedChannelId?: string;
  resolveStatus?: string;
  liveSearchStatus?: string;
  errorMessage?: string;
}

export interface YoutubeLiveResponse {
  streamers: LiveStreamer[];
}

export interface Player {
  id: number;
  name: string;
  ping: number;
}

export interface PlayersResponse {
  serverId: string;
  hostname: string;
  online: number;
  maxPlayers: number;
  players: Player[];
}

export type TabId = "streaming" | "player-finder";

export type GridLayout = "1x1" | "2x1" | "2x2" | "3x2" | "4x2" | "ALL";

export type SidebarFilter = "LIVE" | "ALL";
