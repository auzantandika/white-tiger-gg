import type { StreamerChannel } from "./types";

export const STREAMER_CHANNELS: StreamerChannel[] = [
  {
    id: "fakmon-gg",
    name: "Fakmon GG",
    channelHandle: "@FakmonGG",
    channelUrl: "https://youtube.com/@FakmonGG",
  },
  {
    id: "andrew-bahvana",
    name: "Andrew Bahvana",
    channelHandle: "@ANDREWBAHVANA",
    channelUrl: "https://www.youtube.com/@ANDREWBAHVANA",
  },
  {
    id: "alz-verse",
    name: "Alz Verse",
    channelHandle: "@Alz_Verse",
    channelUrl: "https://www.youtube.com/@Alz_Verse",
  },
  {
    id: "radvondo",
    name: "Radvondo",
    channelHandle: "@radvondo",
    channelUrl: "https://www.youtube.com/@radvondo",
  },
];

export function getStreamerInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
