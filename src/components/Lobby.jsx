import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { createMatch } from '../lib/matchEngine';
import { BOT_PLAYERS, isBot } from '../lib/bots';

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function Lobby({
  user,
  profile,
  onGameStart,
  onRoomCodeChange,
  onlineUsers,
  onInvite,
  onUpdateUsername,
  autoJoinCode,
  onAutoJoinHandled,
}) {
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    if (game) return; // sadece lobi ekranındayken göster
    supabase
      .from('profiles')
      .select('id, username, wins, losses')
      .order('wins', { ascending: false })
      .limit(10)
      .then(({ data }) => setLeaderboard(data || []));
  }, [game]);

  useEffect(() => {
    onRoomCodeChange?.(game?.status === 'LOBBY' ? game.code : null);
  }, [game?.code, game?.status]);

  useEffect(() => {
    if (!game) return undefined;
    const channel = supabase
      .channel(`lobby-${game.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${game.id}` }, (payload) => {
        setGame(payload.new);
        if (payload.new.status === 'PLAYING') onGameStart(payload.new);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [game?.id]);

  useEffect(() => {
    if (!game) return;
    (async () => {
      const realIds = game.player_ids.filter((id) => !isBot(id));
      const { data } = realIds.length
        ? await supabase.from('profiles').select('id, username').in('id', realIds)
        : { data: [] };
      setPlayers(
        game.player_ids.map((id) => {
          if (isBot(id)) return { id, username: BOT_PLAYERS.find((b) => b.id === id).name, bot: true };
          return data?.find((d) => d.id === id) || { id, username: '...' };
        })
      );
    })();
  }, [game?.player_ids?.join(',')]);

  // Davet linkinden veya bir davetten gelen kodu otomatik doldur / katıl
  useEffect(() => {
    if (autoJoinCode && !game) {
      joinRoom(autoJoinCode);
      onAutoJoinHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoinCode]);

  async function createRoom() {
    setBusy(true);
    setError('');
    const code = randomCode();
    const { data, error: err } = await supabase
      .from('games')
      .insert({ code, player_ids: [user.id], status: 'LOBBY' })
      .select()
      .single();
    setBusy(false);
    if (err) return setError(err.message);
    setGame(data);
  }

  async function joinRoom(codeOverride) {
    setBusy(true);
    setError('');
    const code = (codeOverride || joinCode).trim().toUpperCase();
    if (!code) { setBusy(false); return; }
    const { data, error: err } = await supabase.from('games').select('*').eq('code', code).single();
    if (err || !data) {
      setBusy(false);
      return setError('Oda bulunamadı.');
    }
    if (data.player_ids.includes(user.id)) {
      setBusy(false);
      setGame(data);
      if (data.status === 'PLAYING') onGameStart(data);
      return;
    }
    if (data.player_ids.length >= 4) {
      setBusy(false);
      return setError('Oda dolu (4/4).');
    }
    const newIds = [...data.player_ids, user.id];
    const { data: updated, error: err2 } = await supabase
      .from('games')
      .update({ player_ids: newIds })
      .eq('id', data.id)
      .select()
      .single();
    setBusy(false);
    if (err2) return setError(err2.message);
    setGame(updated);
  }

  async function startGame() {
    if (players.length !== 4) return;
    setBusy(true);
    const matchPlayers = players.map((p) => ({ id: p.id, name: p.username }));
    const state = createMatch(matchPlayers);
    const { data, error: err } = await supabase
      .from('games')
      .update({ status: 'PLAYING', state })
      .eq('id', game.id)
      .select()
      .single();
    setBusy(false);
    if (err) return setError(err.message);
    onGameStart(data);
  }

  async function addBot(botId) {
    if (!game || game.player_ids.includes(botId) || game.player_ids.length >= 4) return;
    const newIds = [...game.player_ids, botId];
    const { data, error: err } = await supabase.from('games').update({ player_ids: newIds }).eq('id', game.id).select().single();
    if (err) return setError(err.message);
    setGame(data);
  }

  async function removeBot(botId) {
    if (!game) return;
    const newIds = game.player_ids.filter((id) => id !== botId);
    const { data, error: err } = await supabase.from('games').update({ player_ids: newIds }).eq('id', game.id).select().single();
    if (err) return setError(err.message);
    setGame(data);
  }

  function saveName() {
    onUpdateUsername(nameDraft);
    setEditingName(false);
  }

  function copyInviteLink() {
    const link = `${window.location.origin}/?code=${game.code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const idleUsers = (onlineUsers || []).filter((u) => u.status !== 'oyunda');
  const canInvite = game && game.status === 'LOBBY' && game.player_ids.length < 4;

  return (
    <div className="lobby-screen lobby-screen-split">
      <aside className="panel online-panel">
        <h3>Çevrimiçi</h3>
        {idleUsers.length === 0 && <p className="online-empty">Şu an kimse yok.</p>}
        <ul className="online-list">
          {idleUsers.map((u) => (
            <li key={u.user_id}>
              <span className="online-dot" />
              <span className="online-name">{u.name}</span>
              {canInvite && (
                <button className="online-invite" onClick={() => onInvite(u.user_id)}>
                  Davet et
                </button>
              )}
            </li>
          ))}
        </ul>
        {(onlineUsers || []).some((u) => u.status === 'oyunda') && (
          <>
            <h3 className="online-subhead">Oyunda</h3>
            <ul className="online-list">
              {onlineUsers.filter((u) => u.status === 'oyunda').map((u) => (
                <li key={u.user_id} className="online-playing">
                  <span className="online-dot online-dot-busy" />
                  <span className="online-name">{u.name}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>

      {leaderboard.length > 0 && (
        <aside className="panel leaderboard-panel">
          <h3>Liderlik Tablosu</h3>
          <ol className="leaderboard-list">
            {leaderboard.map((p) => {
              const total = p.wins + p.losses;
              const rate = total > 0 ? Math.round((p.wins / total) * 100) : 0;
              return (
                <li key={p.id} className={p.id === user.id ? 'leaderboard-me' : ''}>
                  <span className="leaderboard-name">{p.username}</span>
                  <span className="leaderboard-record">
                    <span className="lobby-stats-win">{p.wins}G</span> / <span className="lobby-stats-loss">{p.losses}M</span>
                    {total > 0 && <span className="leaderboard-rate"> ({rate}%)</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>
      )}

      <div className="lobby-card-wrap">
        <div className="lobby-header-row">
          {editingName ? (
            <span className="name-edit">
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={20} autoFocus />
              <button className="btn-primary btn-tiny" onClick={saveName}>Kaydet</button>
            </span>
          ) : (
            <span className="name-display">
              {profile?.username}
              <button className="link-btn" onClick={() => { setNameDraft(profile?.username || ''); setEditingName(true); }}>
                değiştir
              </button>
            </span>
          )}
        </div>

        {!game ? (
          <div className="panel lobby-card">
            <h2 className="display">Merhaba {profile?.username}</h2>
            {profile && (profile.wins > 0 || profile.losses > 0) && (
              <p className="lobby-stats">
                <span className="lobby-stats-win">{profile.wins} galibiyet</span>
                {' · '}
                <span className="lobby-stats-loss">{profile.losses} mağlubiyet</span>
              </p>
            )}
            <p className="lobby-sub">Bir oda kur ya da arkadaşının kodunu gir.</p>
            <button className="btn-primary" onClick={createRoom} disabled={busy}>
              Yeni Oda Kur
            </button>
            <div className="lobby-divider"><span>veya</span></div>
            <div className="lobby-join">
              <input placeholder="Oda kodu (örn. AB3X9)" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} maxLength={5} />
              <button className="btn-ghost" onClick={() => joinRoom()} disabled={busy || !joinCode}>
                Katıl
              </button>
            </div>
            {error && <div className="auth-error">{error}</div>}
          </div>
        ) : (
          <div className="panel lobby-card">
            <h2 className="display">Oda: {game.code}</h2>
            <p className="lobby-sub">Bu kodu ya da linki arkadaşlarınla paylaş. 4 kişi olunca başlat.</p>
            <button className="btn-ghost lobby-copy-btn" onClick={copyInviteLink}>
              {copied ? 'Kopyalandı ✓' : 'Davet linkini kopyala'}
            </button>
            <ul className="lobby-players">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className={players[i] ? 'lobby-player-filled' : ''}>
                  {players[i] ? (
                    <span className="player-row-inner">
                      {players[i].username}
                      {players[i].bot && (
                        <button className="link-btn" onClick={() => removeBot(players[i].id)}>çıkar</button>
                      )}
                    </span>
                  ) : (
                    `Bekleniyor (${i + 1}/4)`
                  )}
                </li>
              ))}
            </ul>
            {players.length < 4 && (
              <div className="bot-add-row">
                <span className="bot-add-label">Bot ekle:</span>
                {BOT_PLAYERS.filter((b) => !game.player_ids.includes(b.id)).map((b) => (
                  <button key={b.id} className="btn-ghost btn-tiny" onClick={() => addBot(b.id)}>
                    + {b.name}
                  </button>
                ))}
              </div>
            )}
            <button className="btn-primary" onClick={startGame} disabled={players.length !== 4 || busy}>
              {players.length === 4 ? 'Oyunu Başlat' : `Oyuncu bekleniyor (${players.length}/4)`}
            </button>
            {error && <div className="auth-error">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
