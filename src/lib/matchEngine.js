import { dealHand, cardId } from './cards';
import { legalMoves, resolveTrick, trickScore, PENALTY_TYPES } from './gameEngine';
import { funMessage } from './funMessages';

const TOTAL_HANDS = 20;
const TURN_SECONDS = 12;
const DECLARE_SECONDS = 20;
const OPENING_SECONDS = 20;

function emptyBreakdown() {
  return { KUPA: 0, ERKEK: 0, KIZ: 0, EL: 0, SON_IKI: 0, RIFKI: 0 };
}

export function createMatch(players) {
  // players: [{id, name}, ...] tam 4 kişi, oturma sırasıyla
  const rights = {};
  const totals = {};
  players.forEach((p) => {
    rights[p.id] = { koz: 2, ceza: 3 };
    totals[p.id] = { koz: 0, breakdown: emptyBreakdown() };
  });
  return {
    version: 1,
    players,
    handNumber: 1,
    rights,
    cezaTypeUsed: { KUPA: 0, ERKEK: 0, KIZ: 0, EL: 0, SON_IKI: 0, RIFKI: 0 },
    totals,
    phase: 'DECLARING',
    declarerIndex: 0,
    currentGameType: null,
    trumpSuit: null,
    hands: dealHand(),
    trick: [],
    trickIndex: 0,
    leaderIndex: 0,
    turnIndex: 0,
    turnDeadline: new Date(Date.now() + DECLARE_SECONDS * 1000).toISOString(),
    heartsBroken: false,
    trumpBroken: false,
    collectedPenaltyCards: {},
    trickCountThisHand: {},
    lastTrickWinner: null,
    funMessage: null,
    funMessageCategory: null,
    log: [],
    statsRecorded: false,
  };
}

export function availableDeclareOptions(state) {
  const declarerId = state.players[state.declarerIndex].id;
  const r = state.rights[declarerId];
  const options = [];
  if (r.koz > 0) options.push({ kind: 'KOZ' });
  if (r.ceza > 0) {
    PENALTY_TYPES.forEach((t) => {
      if (state.cezaTypeUsed[t] < 2) options.push({ kind: t });
    });
  }
  return options;
}

export function declareGame(state, gameType, trumpSuit) {
  if (state.phase !== 'DECLARING') return state;
  const s = structuredClone(state);
  const declarerId = s.players[s.declarerIndex].id;
  if (gameType === 'KOZ') {
    s.rights[declarerId].koz -= 1;
    s.trumpSuit = trumpSuit;
  } else {
    s.rights[declarerId].ceza -= 1;
    s.cezaTypeUsed[gameType] += 1;
    s.trumpSuit = null;
  }
  s.currentGameType = gameType;
  s.phase = 'PLAYING';

  // Karo 2'si kimdeyse o elin ilk elini (trick) o açar
  const openerIndex = s.hands.findIndex((hand) => hand.some((c) => c.suit === 'D' && c.rank === 2));
  s.leaderIndex = openerIndex >= 0 ? openerIndex : s.declarerIndex;
  s.turnIndex = s.leaderIndex;

  s.trick = [];
  s.trickIndex = 0;
  s.heartsBroken = false;
  s.trumpBroken = false;
  s.collectedPenaltyCards = {};
  s.trickCountThisHand = {};
  s.turnDeadline = new Date(Date.now() + OPENING_SECONDS * 1000).toISOString();
  s.version += 1;
  return s;
}

export function legalMovesFor(state, playerIndex) {
  if (state.phase !== 'PLAYING' || state.turnIndex !== playerIndex) return [];
  return legalMoves(state.hands[playerIndex], state.trick, state.currentGameType, state.trumpSuit, state.heartsBroken, state.trumpBroken);
}

export function playCard(state, playerIndex, card) {
  if (state.phase !== 'PLAYING' || state.turnIndex !== playerIndex) return state;
  const legal = legalMoves(state.hands[playerIndex], state.trick, state.currentGameType, state.trumpSuit, state.heartsBroken, state.trumpBroken);
  if (!legal.some((c) => cardId(c) === cardId(card))) return state; // illegal hamle yok say

  const s = structuredClone(state);
  s.hands[playerIndex] = s.hands[playerIndex].filter((c) => cardId(c) !== cardId(card));
  s.trick.push({ playerIndex, card });
  if (card.suit === 'H') s.heartsBroken = true;
  if (s.currentGameType === 'KOZ' && card.suit === s.trumpSuit) s.trumpBroken = true;
  s.funMessage = null;
  s.funMessageCategory = null;

  if (s.trick.length < 4) {
    s.turnIndex = (playerIndex + 1) % 4;
    s.turnDeadline = new Date(Date.now() + TURN_SECONDS * 1000).toISOString();
    s.version += 1;
    return s;
  }

  // 4. kağıt da masaya kondu - herkes görsün diye burada DURUYORUZ, henüz sonuçlandırmıyoruz.
  // Sonuçlandırma (resolveCompletedTrick) birkaç saniye sonra ayrı bir adımda yapılacak.
  s.phase = 'TRICK_DONE';
  s.turnDeadline = null;
  s.version += 1;
  return s;
}

const TOTAL_TRIGGER_COUNT = { KIZ: 4, ERKEK: 8, KUPA: 13 };

// Masadaki 4 kağıt bir süre görüldükten sonra çağrılır: eli kazananı belirler, puanı işler,
// gerekiyorsa eli (hatta hepsi çıktıysa) erken bitirir.
export function resolveCompletedTrick(state) {
  if (state.phase !== 'TRICK_DONE') return state;
  const s = structuredClone(state);

  const winnerIndex = resolveTrick(s.trick, s.currentGameType, s.trumpSuit);
  const winnerId = s.players[winnerIndex].id;
  const pts = trickScore(s.trick, s.currentGameType, s.trickIndex, 13);

  applyFunMessage(s, winnerId, pts);
  trackCollectedPenaltyCards(s, winnerId);
  s.trickCountThisHand = { ...s.trickCountThisHand, [winnerId]: (s.trickCountThisHand[winnerId] || 0) + 1 };

  if (s.currentGameType === 'KOZ') {
    s.totals[winnerId].koz += pts;
  } else if (pts !== 0) {
    s.totals[winnerId].breakdown[s.currentGameType] += pts;
  }

  s.lastTrickWinner = winnerIndex;
  s.trickIndex += 1;
  s.trick = [];
  s.phase = 'PLAYING';

  // Rıfkı'da kupa papazı alındıysa el hemen biter
  if (s.currentGameType === 'RIFKI' && pts !== 0) {
    return endHand(s);
  }

  // Kız/Erkek/Kupa'da o türün TÜM kağıtları (4 kız / 8 erkek / 13 kupa) artık dağıtıldıysa,
  // kalan ellerde bu oyun için kazanılacak/kaybedilecek bir şey kalmadı - el hemen biter.
  const totalForType = TOTAL_TRIGGER_COUNT[s.currentGameType];
  if (totalForType) {
    const seenSoFar = Object.values(s.collectedPenaltyCards).reduce((sum, arr) => sum + arr.length, 0);
    if (seenSoFar >= totalForType) {
      return endHand(s);
    }
  }

  if (s.trickIndex >= 13) {
    return endHand(s);
  }

  s.leaderIndex = winnerIndex;
  s.turnIndex = winnerIndex;
  s.turnDeadline = new Date(Date.now() + TURN_SECONDS * 1000).toISOString();
  s.version += 1;
  return s;
}

const PENALTY_TRIGGER = {
  KIZ: (c) => c.rank === 12,
  ERKEK: (c) => c.rank === 11 || c.rank === 13,
  KUPA: (c) => c.suit === 'H',
};

// Kız/Erkek/Kupa almaz oyunlarında, alınan ceza kartlarını (kız/vale-papaz/kupa) o eli alan
// oyuncunun önünde, el bitene kadar açık göstermek için biriktirir.
function trackCollectedPenaltyCards(s, winnerId) {
  const trigger = PENALTY_TRIGGER[s.currentGameType];
  if (!trigger) return;
  const won = s.trick.filter((t) => trigger(t.card)).map((t) => t.card);
  if (won.length === 0) return;
  s.collectedPenaltyCards = { ...s.collectedPenaltyCards };
  s.collectedPenaltyCards[winnerId] = [...(s.collectedPenaltyCards[winnerId] || []), ...won];
}

function applyFunMessage(s, winnerId, pts) {
  const winnerName = s.players.find((p) => p.id === winnerId).name;
  let category = null;
  if (s.currentGameType === 'RIFKI' && pts !== 0) category = 'RIFKI';
  else if (s.currentGameType === 'KIZ' && pts !== 0) category = 'KIZ';
  else if (s.currentGameType === 'ERKEK' && pts !== 0) category = 'ERKEK';
  else if (s.currentGameType === 'SON_IKI' && pts !== 0) category = s.trickIndex === 12 ? 'SON_IKI_SON' : 'SON_IKI_ILK';
  else if (s.currentGameType === 'KUPA' && pts !== 0) category = 'KUPA';
  else if (s.currentGameType === 'EL' && pts !== 0) category = 'EL';

  if (category) {
    s.funMessage = funMessage(category, { name: winnerName, points: pts }, s.lastFunMessageByCategory?.[category]);
    s.funMessageCategory = category;
    s.lastFunMessageByCategory = { ...(s.lastFunMessageByCategory || {}), [category]: s.funMessage };

    const totalPenalty = -(Object.values(s.totals[winnerId].breakdown).reduce((a, b) => a + b, 0));
    if (totalPenalty >= 1000 && totalPenalty - Math.abs(pts) < 1000) {
      s.funMessage = funMessage('MILESTONE', { name: winnerName, points: totalPenalty }, null);
      s.funMessageCategory = 'MILESTONE';
    }
  }
}

function endHand(s) {
  s.phase = 'HAND_END';
  s.handNumber += 1;
  s.trick = [];
  s.turnDeadline = null;

  if (s.handNumber > TOTAL_HANDS) {
    s.phase = 'MATCH_END';
    s.version += 1;
    return s;
  }

  s.declarerIndex = (s.declarerIndex + 1) % 4;
  s.currentGameType = null;
  s.trumpSuit = null;
  s.hands = dealHand();
  s.trickIndex = 0;
  s.heartsBroken = false;
  s.trumpBroken = false;
  s.collectedPenaltyCards = {};
  s.trickCountThisHand = {};
  s.phase = 'DECLARING';
  s.turnDeadline = new Date(Date.now() + DECLARE_SECONDS * 1000).toISOString();
  s.version += 1;
  return s;
}

export function netScore(state, playerId) {
  const t = state.totals[playerId];
  const cezaTotal = Object.values(t.breakdown).reduce((a, b) => a + b, 0); // negatif
  return t.koz + cezaTotal;
}

export function cezaTotal(state, playerId) {
  return Object.values(state.totals[playerId].breakdown).reduce((a, b) => a + b, 0);
}

export { TURN_SECONDS, DECLARE_SECONDS, OPENING_SECONDS, TOTAL_HANDS };
