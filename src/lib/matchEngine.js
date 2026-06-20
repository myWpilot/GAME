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
