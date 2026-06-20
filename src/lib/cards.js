// Kart yapısı: { suit: 'S'|'H'|'D'|'C', rank: 2..14 }  14=As, 13=Papaz(K), 12=Kız(Q), 11=Vale(J)
export const SUITS = ['S', 'H', 'D', 'C'];
export const SUIT_INFO = {
  S: { symbol: '♠', name: 'Maça', color: 'black' },
  H: { symbol: '♥', name: 'Kupa', color: 'red' },
  D: { symbol: '♦', name: 'Karo', color: 'red' },
  C: { symbol: '♣', name: 'Sinek', color: 'black' },
};
const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function rankLabel(rank) {
  return RANK_LABEL[rank] || String(rank);
}

export function cardId(card) {
  return `${card.suit}${card.rank}`;
}

export function isMale(card) {
  return card.rank === 11 || card.rank === 13; // Vale veya Papaz
}
export function isQueen(card) {
  return card.rank === 12;
}
export function isHeart(card) {
  return card.suit === 'H';
}
export function isRifki(card) {
  return card.suit === 'H' && card.rank === 13; // Kupa Papazı
}

export function freshDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffle(deck) {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 4 oyuncuya 13'er kart dağıtır, sıralı (büyükten küçüğe, renge göre grup) tutar
export function dealHand() {
  const deck = shuffle(freshDeck());
  const hands = [[], [], [], []];
  for (let i = 0; i < 52; i++) {
    hands[i % 4].push(deck[i]);
  }
  return hands.map(sortHand);
}

export function sortHand(cards) {
  const order = { S: 0, H: 1, D: 2, C: 3 };
  return cards.slice().sort((a, b) => {
    if (a.suit !== b.suit) return order[a.suit] - order[b.suit];
    return b.rank - a.rank;
  });
}
