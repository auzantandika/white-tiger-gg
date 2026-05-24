function hasChannelOwnershipMatch(streamer) {
  if (streamer.channelOwnershipMatch === false) {
    return false;
  }

  if (streamer.detectedVideoChannelId && streamer.expectedChannelId) {
    return streamer.detectedVideoChannelId === streamer.expectedChannelId;
  }

  return true;
}

function isConfirmedLive(streamer) {
  return (
    streamer.status === "LIVE" &&
    Boolean(streamer.videoId) &&
    hasChannelOwnershipMatch(streamer)
  );
}

function countConfirmedLive(streamers) {
  return streamers.filter(isConfirmedLive).length;
}

module.exports = {
  hasChannelOwnershipMatch,
  isConfirmedLive,
  countConfirmedLive,
};
