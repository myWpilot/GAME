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
  KUPA: 30,   // her kupa
  ERKEK: 60,  // her
