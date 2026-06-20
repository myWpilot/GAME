import { isMale, isQueen, isHeart, isRifki } from './cards';

export const GAME_TYPES = {
  KOZ: 'KOZ',
  KUPA: 'KUPA',
  ERKEK: 'ERKEK',
  KIZ: 'KIZ',
  EL: 'EL',
  SON_IKI: 'SON_IKI',
  RIFKI: 'RIFKI',
};

export const PENALTY_TYPES = ['KUPA', 'ERKEK', 'KIZ', 'EL', 'SON_IKI', 'RIFKI'];

export const GAME_LABELS = {
  KOZ: 'Koz',
  KUPA: 'Kupa Almaz',
  ERKEK: 'Erkek Almaz',
  KIZ: 'Kız Almaz',
  EL: 'El Almaz',
  SON_IKI: 'Son İki',
  RIFKI: 'Rıfkı',
};

export const PENALTY_POINTS = {
  KUPA: 30,
  ERKEK: 60,
  KIZ: 100,
  EL: 50,
  SON_IKI: 180,
  RIFKI: 320,
};
export const TRUMP_TRICK_POINTS = 50;

export function legalMoves(hand, trick, gameType, trumpSuit, heartsBroken, trumpBroken) {
  if (trick.length === 0) {
    if ((gameType === 'KUPA' || gameType === 'RIFKI') && !heartsBroken) {
      const nonHearts = hand.filter((c) => !isHeart(c));
      if (nonHearts.length > 0) return nonHearts;
    }
    if (gameType === 'KOZ' && !trumpBroken) {
      const nonTrump = hand.filter((c) => c.suit !== trumpSuit);
      if (nonTrump.length > 0) return nonTrump;
    }
    return hand.slice();
  }

  const leadSuit = trick[0].card.suit;
  const sameSuit = hand.filter((c) => c.suit === leadSuit);
  if (sameSuit.length > 0) return sameSuit;

  if (gameType === 'KIZ') {
    const queens = hand.filter(isQueen);
    if (queens.length > 0) return queens;
  } else if (gameType === 'ERKEK') {
    const males = hand.filter(isMale);
    if (males.length > 0) return males;
  } else if (gameType === 'KUPA' || gameType === 'RIFKI') {
    const hearts = hand.filter(isHeart);
    if (hearts.length > 0) return hearts;
  }
  return hand.slice();
}

export function resolveTrick(trick, gameType, trumpSuit) {
  const leadSuit = trick[0].card.suit;
  if (gameType === 'KOZ') {
    const trumps = trick.filter((t) => t.card.suit === trumpSuit);
    const pool = trumps.length > 0 ? trumps : trick.filter((t) => t.card.suit === leadSuit);
    return pool.reduce((best, cur) => (cur.card.rank > best.card.rank ? cur : best)).playerIndex;
  }
  const pool = trick.filter((t) => t.card.suit === leadSuit);
  return pool.reduce((best, cur) => (cur.card.rank > best.card.rank ? cur : best)).playerIndex;
}

export function trickScore(trick, gameType, trickIndex, totalTricks = 13) {
  switch (gameType) {
    case 'KOZ':
      return TRUMP_TRICK_POINTS;
    case 'KUPA': {
      const n = trick.filter((t) => isHeart(t.card)).length;
      return -PENALTY_POINTS.KUPA * n;
    }
    case 'ERKEK': {
      const n = trick.filter((t) => isMale(t.card)).length;
      return -PENALTY_POINTS.ERKEK * n;
    }
    case 'KIZ': {
      const n = trick.filter((t) => isQueen(t.card)).length;
      return -PENALTY_POINTS.KIZ * n;
    }
    case 'EL':
      return -PENALTY_POINTS.EL;
    case 'SON_IKI':
      return trickIndex >= totalTricks - 2 ? -PENALTY_POINTS.SON_IKI : 0;
    case 'RIFKI': {
      const hasRifki = trick.some((t) => isRifki(t.card));
      return hasRifki ? -PENALTY_POINTS.RIFKI : 0;
    }
    default:
      return 0;
  }
}

export function trickBreakdown(trick, gameType, trickIndex, totalTricks = 13) {
  const pts = trickScore(trick, gameType, trickIndex, totalTricks);
  if (pts === 0) return null;
  return { type: gameType, points: pts };
}
