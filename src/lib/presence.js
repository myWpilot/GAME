import { supabase } from '../supabaseClient';

export function openPresenceChannel(user, profile, onSync) {
  const channel = supabase.channel('online-users', {
    config: { presence: { key: user.id } },
  });

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const list = Object.values(state)
      .flat()
      .filter((p) => p.user_id !== user.id);
    onSync(list);
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ user_id: user.id, name: profile?.username || 'Oyuncu', status: 'idle' });
    }
  });

  return channel;
}

export function trackPresence(channel, user, profile, status) {
  if (!channel) return;
  channel.track({ user_id: user.id, name: profile?.username || 'Oyuncu', status });
}

export function listenForInvites(userId, onInvite) {
  const channel = supabase
    .channel(`invite-${userId}`)
    .on('broadcast', { event: 'invite' }, ({ payload }) => onInvite(payload))
    .subscribe();
  return channel;
}

export async function sendInvite(targetUserId, fromName, code) {
  const channel = supabase.channel(`invite-${targetUserId}`);
  await new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event: 'invite', payload: { fromName, code } });
        resolve();
      }
    });
  });
  setTimeout(() => supabase.removeChannel(channel), 1200);
}
