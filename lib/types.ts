export type StreamStatus = "LIVE" | "OFFLINE" | "UNKNOWN";

export interface StreamerChannel {
  id: string;
  name: string;
  channelUrl: string;
  channelHandle?: string;
  channelId?: string;
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
  channelId?: string;
  resolvedChannelId?: string;
  resolveStatus?: string;
  livePageStatus?: string;
  livePageVideoId?: string;
  livePageVerifyStatus?: string;
  detectedVideoId?: string;
  detectedVideoChannelId?: string;
  detectedVideoChannelTitle?: string;
  expectedChannelId?: string;
  channelOwnershipMatch?: boolean;
  uploadsPlaylistId?: string;
  playlistItemsStatus?: string;
  videosListStatus?: string;
  videoCheckedCount?: number;
  finalStatus?: string;
  errorMessage?: string;
  lastCheckedAt?: string;
  matchedTags?: string[];
  hasAllowedTag?: boolean;
}

export interface YoutubeLiveResponse {
  streamers: LiveStreamer[];
  totalChannels?: number;
  lastCheckedAt?: string;
  scannedCount?: number;
  scanBatchSize?: number;
  recheckedLiveCount?: number;
  livePrioritized?: boolean;
  scannedStreamerIds?: string[];
  skippedStreamerIds?: string[];
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

export type GridLayout = "1x1" | "2x1" | "2x2" | "3x2" | "3x3" | "4x2" | "ALL";

export type SidebarFilter = "LIVE" | "ALL";
