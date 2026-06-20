import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { openPresenceChannel, trackPresence, listenForInvites, sendInvite } from './lib/presence';
import Auth from './components/Auth';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import './components/components.css';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = yükleniyor
  const [profile, setProfile] = useState(null);
  const [gameRow, setGameRow] = useState(null);
  const [roomCode, setRoomCode] = useState(null); // henüz başlamamış odanın kodu (davet için)
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [pendingInvite, setPendingInvite] = useState(null);
  const presenceChannelRef = useRef(null);

  const initialCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('code')?.toUpperCase() || null;
  }, []);
  const [autoJoinCode, setAutoJoinCode] = useState(initialCode);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    supabase
      .from('profiles')
      .select('id, username, wins, losses')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data));
  }, [session?.user?.id]);

  function refreshProfile() {
    if (!session?.user) return;
    supabase
      .from('profiles')
      .select('id, username, wins, losses')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data));
  }

  // Online kullanıcı listesi (presence) ve kişisel davet kanalı
  useEffect(() => {
    if (!session?.user || !profile) return undefined;
    const presence = openPresenceChannel(session.user, profile, setOnlineUsers);
    presenceChannelRef.current = presence;
    const inviteCh = listenForInvites(session.user.id, (payload) => setPendingInvite(payload));
    return () => {
      supabase.removeChannel(presence);
      supabase.removeChannel(inviteCh);
      presenceChannelRef.current = null;
    };
  }, [session?.user?.id, profile?.username]);

  // Oyundaysa/odadaysa presence durumunu güncelle
  useEffect(() => {
    if (!presenceChannelRef.current || !session?.user) return;
    trackPresence(presenceChannelRef.current, session.user, profile, gameRow ? 'oyunda' : 'idle');
  }, [gameRow, profile?.username]);

  async function updateUsername(newName) {
    if (!newName?.trim()) return;
    await supabase.from('profiles').update({ username: newName.trim() }).eq('id', session.user.id);
    setProfile((p) => ({ ...p, username: newName.trim() }));
  }

  async function handleInvite(targetUserId) {
    if (!roomCode || !profile) return;
    await sendInvite(targetUserId, profile.username, roomCode);
  }

  function acceptInvite() {
    setAutoJoinCode(pendingInvite.code);
    setPendingInvite(null);
  }

  if (session === undefined) {
    return <div className="loading-screen">Yükleniyor...</div>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <>
      {pendingInvite && !gameRow && (
        <div className="invite-toast">
          <span>
            <strong>{pendingInvite.fromName}</strong> seni <strong>{pendingInvite.code}</strong> odasına davet etti.
          </span>
          <div className="invite-toast-actions">
            <button className="btn-primary" onClick={acceptInvite}>Katıl</button>
            <button className="btn-ghost" onClick={() => setPendingInvite(null)}>Kapat</button>
          </div>
        </div>
      )}

      {!gameRow ? (
        <Lobby
          user={session.user}
          profile={profile}
          onGameStart={setGameRow}
          onRoomCodeChange={setRoomCode}
          onlineUsers={onlineUsers}
          onInvite={handleInvite}
          onUpdateUsername={updateUsername}
          autoJoinCode={autoJoinCode}
          onAutoJoinHandled={() => setAutoJoinCode(null)}
        />
      ) : (
        <GameTable
          gameRow={gameRow}
          user={session.user}
          onReturnToLobby={() => {
            setGameRow(null);
            refreshProfile();
          }}
        />
      )}
    </>
  );
}
