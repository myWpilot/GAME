import { availableDeclareOptions } from './matchEngine';

// Botlar sabit, geçerli-UUID-biçimli id'lerle tanımlı (Postgres uuid[] kolonuna uymas için).
export const BOT_PLAYERS = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Bot Ahmet' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Bot Zeynep' },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Bot Mehmet' },
];

export function isBot(id) {
  return BOT_PLAYERS.some((b) => b.id === id);
}

export function botName(id) {
  return BOT_PLAYERS.find((b) => b.id === id)?.name;
}

function lowest(cards) {
  return cards.reduce((min, c) => (c.rank < min.rank ? c : min), cards[0]);
}
function highest(cards) {
  return cards.reduce((max, c) => (c.rank > max.rank ? c : max), cards[0]);
}

function currentBestInTrick(trick, leadSuit, trumpSuit, gameType) {
  if (trick.length === 0) return null;
  if (gameType === 'KOZ') {
    const trumps = trick.filter((t) => t.card.suit === trumpSuit);
    const pool = trumps.length > 0 ? trumps : trick.filter((t) => t.card.suit === leadSuit);
    return pool.length ? pool.reduce((best, cur) => (cur.card.rank > best.card.rank ? cur : best)).card : null;
  }
  const pool = trick.filter((t) => t.card.suit === leadSuit);
  return pool.length ? pool.reduce((best, cur) => (cur.card.rank > best.card.rank ? cur : best)).card : null;
}

function chooseKozCard(state, trick, legalCards) {
  const trumpSuit = state.trumpSuit;
  if (trick.length === 0) {
    // Açarken eli almaya çalış: elindeki en güçlü kartla aç
    return highest(legalCards);
  }
  const leadSuit = trick[0].card.suit;
  const best = currentBestInTrick(trick, leadSuit, trumpSuit, 'KOZ');
  const winningOptions = legalCards.filter((c) => {
    if (!best) return true;
    if (c.suit === trumpSuit && best.suit !== trumpSuit) return true;
    if (c.suit === trumpSuit && best.suit === trumpSuit) return c.rank > best.rank;
    if (c.suit === leadSuit && best.suit === leadSuit) return c.rank > best.rank;
    return false;
  });
  // Eli alabiliyorsa, almaya yetecek EN DÜŞÜK kartla al (gücünü boşa harcama)
  if (winningOptions.length > 0) return lowest(winningOptions);
  // Alamıyorsa en düşüğünü ver
  return lowest(legalCards);
}

function isTriggerCard(card, gameType) {
  switch (gameType) {
    case 'KUPA': return card.suit === 'H';
    case 'KIZ': return card.rank === 12;
    case 'ERKEK': return card.rank === 11 || card.rank === 13;
    case 'RIFKI': return card.suit === 'H' && card.rank === 13;
    default: return false;
  }
}

function trickHasTrigger(trick, gameType) {
  return trick.some((t) => isTriggerCard(t.card, gameType));
}

function choosePenaltyCard(state, trick, legalCards) {
  const gameType = state.currentGameType;

  // Son İki: son iki ele kadar (ilk 11 el) kimin el aldığı önemsiz - tehlikeli yüksek
  // kartları şimdiden eritip düşükleri son iki el için sakla.
  if (gameType === 'SON_IKI' && state.trickIndex < 11) {
    return highest(legalCards);
  }

  if (trick.length === 0) {
    // Açarken en güvenli (düşük) kartla aç
    return lowest(legalCards);
  }

  const leadSuit = trick[0].card.suit;
  const sameSuitLegal = legalCards.filter((c) => c.suit === leadSuit);
  const isLastToPlay = trick.length === 3;
  const triggerSeen = trickHasTrigger(trick, gameType);

  // Kupa/Kız/Erkek/Rıfkı'da: sonuncuyuz ve masada hâlâ tehlikeli kart (kız/kupa/erkek/rıfkı)
  // yoksa, bu eli alsak bile ceza yok demektir. Tehlikeli büyük kartımızı (örn. kızdan
  // büyük Papaz/As) tam bu güvenli pencerede, riske girmeden eritebiliriz.
  if (isLastToPlay && !triggerSeen && gameType !== 'EL') {
    const candidates = sameSuitLegal.length > 0 ? sameSuitLegal : legalCards;
    const nonTrigger = candidates.filter((c) => !isTriggerCard(c, gameType));
    if (nonTrigger.length > 0) return highest(nonTrigger);
  }

  if (sameSuitLegal.length === 0) {
    // Açılan renkten kartımız yok ya da mecburi atma durumundayız - bu eli zaten alamayız,
    // o yüzden elimizdeki en tehlikeli (yüksek) kartı güvenle eritebiliriz.
    return highest(legalCards);
  }

  const best = currentBestInTrick(trick, leadSuit, null, gameType);
  const safeOptions = sameSuitLegal.filter((c) => !best || c.rank < best.rank);
  if (safeOptions.length > 0) {
    // Eli almayacak en YÜKSEK kartı at (düşükleri ileriki eller için sakla)
    return highest(safeOptions);
  }
  // Mecbur eli alacaksak, mümkün olan en azıyla alalım
  return lowest(sameSuitLegal);
}

export function chooseBotCard(state, legalCards) {
  if (legalCards.length === 1) return legalCards[0];
  if (state.currentGameType === 'KOZ') return chooseKozCard(state, state.trick, legalCards);
  return choosePenaltyCard(state, state.trick, legalCards);
}

export function botDeclareChoice(state) {
  const declarerIdx = state.declarerIndex;
  const hand = state.hands[declarerIdx];
  const options = availableDeclareOptions(state);
  if (options.length === 0) return null;

  const suitCounts = { S: 0, H: 0, D: 0, C: 0 };
  hand.forEach((c) => { suitCounts[c.suit] += 1; });
  const bestSuit = Object.entries(suitCounts).sort((a, b) => b[1] - a[1])[0];

  const hasKoz = options.some((o) => o.kind === 'KOZ');
  // Koz'u sadece elde gerçekten güçlü bir renk varsa (5+ kart) tercih et
  if (hasKoz && bestSuit[1] >= 5) {
    return { kind: 'KOZ', trumpSuit: bestSuit[0] };
  }

  const cezaOptions = options.filter((o) => o.kind !== 'KOZ');
  if (cezaOptions.length === 0) {
    return hasKoz ? { kind: 'KOZ', trumpSuit: bestSuit[0] } : null;
  }

  // Her ceza türü için elin ne kadar "tehlikeli" olduğunu puanla, en güvenlisini seç
  const danger = {
    KUPA: hand.filter((c) => c.suit === 'H').length,
    ERKEK: hand.filter((c) => c.rank === 11 || c.rank === 13).length,
    KIZ: hand.filter((c) => c.rank === 12).length,
    RIFKI: hand.some((c) => c.suit === 'H' && c.rank === 13) ? 6 : 0,
    EL: hand.filter((c) => c.rank >= 11).length,
    SON_IKI: hand.filter((c) => c.rank >= 12).length,
  };

  const sorted = cezaOptions.slice().sort((a, b) => (danger[a.kind] ?? 9) - (danger[b.kind] ?? 9));
  return sorted[0];
}
