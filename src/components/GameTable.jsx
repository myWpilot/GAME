import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import Card from './Card';
import ScorePanel from './ScorePanel';
import {
  declareGame,
  playCard,
  resolveCompletedTrick,
  legalMovesFor,
  availableDeclareOptions,
  netScore,
  TURN_SECONDS,
} from '../lib/matchEngine';
import { GAME_LABELS } from '../lib/gameEngine';
import { SUIT_INFO, cardId } from '../lib/cards';
import { isBot, chooseBotCard, botDeclareChoice } from '../lib/bots';

export default function GameTable({ gameRow, user, onReturnToLobby }) {
  const [row, setRow] = useState(gameRow);
  const [now, setNow] = useState(Date.now());
  const [suitPicker, setSuitPicker] = useState(false);
  const autoPlayedFor = useRef(null);

  const state = row.state;
  const myIndex = state.players.findIndex((p) => p.id === user.id);
  const myHand = state.hands[myIndex] || [];
  const legal = legalMovesFor(state, myIndex);
  const isMyTurn = state.phase === 'PLAYING' && state.turnIndex === myIndex;
  const isMyDeclare = state.phase === 'DECLARING' && state.declarerIndex === myIndex;
  const displayTrick = state.trick; // artık gerçek state - 4. kağıt TRICK_DONE fazında gerçekten masada duruyor

  useEffect(() => {
    const channel = supabase
      .channel(`game-${row.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${row.id}` }, (payload) => {
        setRow(payload.new);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [row.id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // 4 kağıt da masaya konduktan ~1.3sn sonra eli sonuçlandır (kazananı belirle, puanı işle, temizle)
  useEffect(() => {
    if (state.phase !== 'TRICK_DONE') return undefined;
    const firstHumanIndex = state.players.findIndex((p) => !isBot(p.id));
    if (myIndex !== firstHumanIndex) return undefined;
    const timer = setTimeout(() => {
      pushState(resolveCompletedTrick(state));
    }, 1300);
    return () => clearTimeout(timer);
  }, [state.phase, state.version, myIndex]);

  // Süre dolunca otomatik kart oyna (sadece sırası gelen oyuncunun kendi cihazı tetikler)
  useEffect(() => {
    if (!isMyTurn || !state.turnDeadline) return;
    const remaining = new Date(state.turnDeadline).getTime() - now;
    const key = `${state.version}`;
    if (remaining <= 0 && autoPlayedFor.current !== key) {
      autoPlayedFor.current = key;
      const choice = legal[Math.floor(Math.random() * legal.length)];
      if (choice) submitMove(choice);
    }
  }, [now, isMyTurn, state.turnDeadline, state.version]);

  // Beyan süresi dolunca otomatik (rastgele geçerli) beyan yap
  const autoDeclaredFor = useRef(null);
  useEffect(() => {
    if (!isMyDeclare || !state.turnDeadline) return;
    const remaining = new Date(state.turnDeadline).getTime() - now;
    const key = `${state.version}`;
    if (remaining <= 0 && autoDeclaredFor.current !== key) {
      autoDeclaredFor.current = key;
      const choice = botDeclareChoice(state);
      if (choice) submitDeclare(choice.kind, choice.trumpSuit);
    }
  }, [now, isMyDeclare, state.turnDeadline, state.version]);

  // Bot oyuncuları otomatik oynatır. Birden fazla gerçek oyuncu varsa karışıklık olmasın diye
  // sadece koltuk sırasına göre ilk gerçek (bot olmayan) oyuncunun cihazı botları yönetir.
  const botActedFor = useRef(null);
  useEffect(() => {
    if (state.phase === 'MATCH_END' || state.phase === 'HAND_END') return undefined;
    const firstHumanIndex = state.players.findIndex((p) => !isBot(p.id));
    if (myIndex !== firstHumanIndex) return undefined;
    const key = `${state.version}`;
    if (botActedFor.current === key) return undefined;

    if (state.phase === 'DECLARING' && isBot(state.players[state.declarerIndex].id)) {
      botActedFor.current = key;
      const timer = setTimeout(() => {
        const choice = botDeclareChoice(state);
        if (!choice) return;
        pushState(declareGame(state, choice.kind, choice.trumpSuit));
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (state.phase === 'PLAYING' && isBot(state.players[state.turnIndex].id)) {
      botActedFor.current = key;
      const botIdx = state.turnIndex;
      const botLegal = legalMovesFor(state, botIdx);
      const timer = setTimeout(() => {
        const card = chooseBotCard(state, botLegal);
        if (card) pushState(playCard(state, botIdx, card));
      }, 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state.version, myIndex]);

  // Maç bitince kazanma/kaybetme istatistiklerini bir kez kaydet (karışıklık olmasın diye sadece ilk gerçek oyuncu yapar)
  useEffect(() => {
    if (state.phase !== 'MATCH_END' || state.statsRecorded) return;
    const firstHumanIndex = state.players.findIndex((p) => !isBot(p.id));
    if (myIndex !== firstHumanIndex) return;
    (async () => {
      for (const p of state.players) {
        if (isBot(p.id)) continue;
        const field = netScore(state, p.id) >= 0 ? 'wins' : 'losses';
        const { data } = await supabase.from('profiles').select(field).eq('id', p.id).single();
        if (data) {
          await supabase.from('profiles').update({ [field]: (data[field] || 0) + 1 }).eq('id', p.id);
        }
      }
      pushState({ ...state, statsRecorded: true, version: state.version + 1 });
    })();
  }, [state.phase, state.statsRecorded, myIndex]);

  async function pushState(nextState) {
    const { error } = await supabase.from('games').update({ state: nextState }).eq('id', row.id);
    if (error) console.error(error);
  }

  function submitMove(card) {
    const next = playCard(state, myIndex, card);
    pushState(next);
  }

  function submitDeclare(kind, trumpSuit) {
    const next = declareGame(state, kind, trumpSuit);
    pushState(next);
    setSuitPicker(false);
  }

  if (state.phase === 'MATCH_END') {
    return <MatchEnd state={state} onReturnToLobby={onReturnToLobby} />;
  }

  const secondsLeft = state.turnDeadline
    ? Math.max(0, Math.ceil((new Date(state.turnDeadline).getTime() - now) / 1000))
    : null;

  return (
    <div className="table-screen">
      <div className="table-main">
        {[1, 2, 3].map((rel) => {
          const i = (myIndex + rel) % 4;
          const p = state.players[i];
          const posClass = rel === 1 ? 'opponent-left' : rel === 2 ? 'opponent-top' : 'opponent-right';
          return (
            <div
              key={p.id}
              className={`opponent ${posClass} ${state.turnIndex === i && state.phase === 'PLAYING' ? 'opponent-active' : ''}`}
            >
              <div className="opponent-name">
                {p.name}
                {state.declarerIndex === i && <span className="declarer-badge">Beyan</span>}
              </div>
              <div className="opponent-cards">
                {posClass === 'opponent-top' ? (
                  Array.from({ length: state.hands[i].length }).map((_, k) => <Card key={k} faceDown small />)
                ) : (
                  <>
                    <Card faceDown small />
                    <span className="opponent-card-count">×{state.hands[i].length}</span>
                  </>
                )}
              </div>
              <PenaltyCardsRow cards={state.collectedPenaltyCards?.[p.id]} />
              {state.currentGameType === 'EL' && (
                <span className="trick-count-badge">{state.trickCountThisHand?.[p.id] || 0} el</span>
              )}
            </div>
          );
        })}

        <div className="felt-center">
          <div className="game-banner">
            <span className="game-type">
              {state.currentGameType ? GAME_LABELS[state.currentGameType] : 'Beyan bekleniyor'}
              {state.currentGameType === 'KOZ' && state.trumpSuit && (
                <span className={`suit-icon ${SUIT_INFO[state.trumpSuit].color}`}> {SUIT_INFO[state.trumpSuit].symbol}</span>
              )}
            </span>
            {secondsLeft !== null && (
              <span className={`timer ${secondsLeft <= 3 ? 'timer-urgent' : ''}`}>{secondsLeft}s</span>
            )}
          </div>

          <div className="trick-area">
            {displayTrick.map((t) => (
              <div key={t.playerIndex} className={`trick-card trick-pos-${(t.playerIndex - myIndex + 4) % 4}`}>
                <Card card={t.card} />
                <span className="trick-card-name">{state.players[t.playerIndex].name}</span>
              </div>
            ))}
          </div>

          {state.funMessage && <div className="fun-banner">{state.funMessage}</div>}

          {isMyDeclare && (
            <DeclarePanel
              state={state}
              suitPicker={suitPicker}
              setSuitPicker={setSuitPicker}
              onDeclare={submitDeclare}
            />
          )}

          {state.phase === 'HAND_END' && <div className="hand-end-note">El bitti, yeni el dağıtılıyor...</div>}
        </div>

        <div className="my-area">
          <div className="my-hand">
            {['S', 'H', 'C', 'D'].map((suit) => {
              const group = myHand.filter((c) => c.suit === suit).sort((a, b) => b.rank - a.rank);
              if (group.length === 0) {
                return <div key={suit} className="hand-suit-group hand-suit-empty"><div className="hand-suit-placeholder" /></div>;
              }
              return (
                <div key={suit} className="hand-suit-group">
                  {group.map((c) => (
                    <Card
                      key={cardId(c)}
                      card={c}
                      onClick={isMyTurn ? submitMove : undefined}
                      disabled={!isMyTurn || !legal.some((l) => cardId(l) === cardId(c))}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          <PenaltyCardsRow cards={state.collectedPenaltyCards?.[user.id]} />
          {state.currentGameType === 'EL' && (
            <span className="trick-count-badge">{state.trickCountThisHand?.[user.id] || 0} el</span>
          )}
          {isMyTurn && <div className="turn-hint">Sıra sende — {TURN_SECONDS} saniyen var</div>}
        </div>
      </div>

      <ScorePanel state={state} myId={user.id} />
    </div>
  );
}

function PenaltyCardsRow({ cards }) {
  if (!cards || cards.length === 0) return null;
  return (
    <div className="penalty-cards-row">
      {cards.map((c) => (
        <Card key={cardId(c)} card={c} small />
      ))}
    </div>
  );
}

function DeclarePanel({ state, suitPicker, setSuitPicker, onDeclare }) {
  const options = availableDeclareOptions(state);
  const hasKoz = options.some((o) => o.kind === 'KOZ');
  const cezaOptions = options.filter((o) => o.kind !== 'KOZ');

  if (suitPicker) {
    return (
      <div className="declare-panel">
        <p>Koz rengini seç:</p>
        <div className="suit-pick-row">
          {['S', 'H', 'D', 'C'].map((s) => (
            <button key={s} className={`suit-pick suit-${SUIT_INFO[s].color}`} onClick={() => onDeclare('KOZ', s)}>
              {SUIT_INFO[s].symbol}
            </button>
          ))}
        </div>
        <button className="btn-ghost" onClick={() => setSuitPicker(false)}>Geri</button>
      </div>
    );
  }

  return (
    <div className="declare-panel">
      <p>Sıra sende, oyunu beyan et:</p>
      <div className="declare-options">
        {hasKoz && (
          <button className="btn-primary" onClick={() => setSuitPicker(true)}>
            Koz ({state.rights[state.players[state.declarerIndex].id].koz} hak)
          </button>
        )}
        {cezaOptions.map((o) => (
          <button key={o.kind} className="btn-ghost declare-ceza" onClick={() => onDeclare(o.kind)}>
            {GAME_LABELS[o.kind]}
          </button>
        ))}
      </div>
    </div>
  );
}

function MatchEnd({ state, onReturnToLobby }) {
  const ranked = state.players
    .map((p) => ({ ...p, net: netScore(state, p.id) }))
    .sort((a, b) => b.net - a.net);

  return (
    <div className="match-end-screen">
      <div className="panel match-end-card">
        <h2 className="display">Oyun Bitti</h2>
        <ol className="match-end-list">
          {ranked.map((p) => (
            <li key={p.id} className={p.net < 0 ? 'match-end-loser' : 'match-end-winner'}>
              <span>{p.name}</span>
              <span>{p.net}</span>
            </li>
          ))}
        </ol>
        <p className="match-end-note">0'ın altında kalanlar oyunu kaybetti.</p>
        {onReturnToLobby && (
          <button className="btn-primary match-end-back" onClick={onReturnToLobby}>
            Lobiye Dön
          </button>
        )}
      </div>
    </div>
  );
}
