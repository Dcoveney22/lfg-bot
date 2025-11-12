import { raids } from "./store.js";

export function handleVoiceState(oldState, newState, client) {
  const vcId = oldState.channelId ?? newState.channelId;
  const raid = [...raids.values()].find((r) => r.voiceChannelId === vcId);
  if (!raid) return;

  const vc = client.channels.cache.get(vcId);
  const count = vc?.members.size || 0;

  if (count === 0) {
    if (!raid.lastEmptyAt) {
      raid.lastEmptyAt = Date.now();
      setTimeout(async () => {
        const vc2 = await client.channels
          .fetch(raid.voiceChannelId)
          .catch(() => null);
        if (!vc2 || vc2.members.size > 0) return;
        await vc2.delete("Raid VC timeout");
        raids.delete(raid.id);
      }, 60 * 60 * 1000);
    }
  } else raid.lastEmptyAt = null;
}
