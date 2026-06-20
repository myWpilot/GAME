// Her kategori için şablon havuzu. {name} oyuncu adıyla, {points} puanla değişir.
const POOLS = {
  KIZ: [
    '{name} yine bir kızı götürdü, sicili bozuk valla.',
    '{name} kızlarla arası hiç iyi değil, bir tane daha kucağına düştü.',
    'Kızlar {name}\'den kaçamadı, -{points} cebe gitti.',
    '{name} kız toplama ustası oldu resmen.',
    'Bir kız daha {name}\'e gönül verdi, -{points}.',
    '{name}, kızı görünce duramadı: -{points}.',
  ],
  ERKEK: [
    '{name} bekarlığa veda etti, bayrak {name}\'de!',
    'Damat adayımız belli oldu: {name} (-{points}).',
    '{name} bir erkek daha kaptı, bayrağı çekiyoruz.',
    'Düğün hazırlıkları başlasın, {name} erkek topladı.',
    '{name}\'in erkek koleksiyonu büyüyor: -{points}.',
    'Vale mi Papaz mı fark etmez, {name} hepsini topluyor.',
  ],
  RIFKI: [
    'RIFKI! {name} masaya kupa papazıyla giriş yaptı, -{points}.',
    '{name} rıfkıyı yedi, masada sessizlik...',
    'Tam -320, {name} bu eli unutmayacak.',
    'Kupa papazı {name}\'i buldu, kimse kaçamıyor.',
  ],
  SON_IKI_ILK: [
    '{name} son ikinin ilkini yedi, -{points}. Bir tane daha var...',
    'Geri sayım başladı: {name} sondan bir önceki eli aldı, -{points}.',
    '{name} son ikiye girdi bile, -{points}.',
  ],
  SON_IKI_SON: [
    '{name} sonuncuyu da aldı, eli kapattı: -{points}.',
    'Bitti! {name} son eli de topladı, -{points}.',
    '{name} sona kadar dayandı ama son elde çakıldı: -{points}.',
  ],
  EL: [
    '{name} bir el daha aldı, -{points}.',
    'Eli alan yine {name}: -{points}.',
  ],
  KUPA: [
    '{name} kupayı yuttu, -{points}.',
    'Kupa {name}\'in elinde kaldı: -{points}.',
  ],
  MILESTONE: [
    '{name} ceza yemekten doyamadı, tablo kırmızıya boyandı.',
    '{name} bin cezayı geçti, bu el efsane olacak.',
    '{name} artık ceza şampiyonu, kupa hak ediyor (espri bu, kupa almasın).',
  ],
  KING: [
    '{name} KING yaptı! Tüm eller {name}\'de, tek başına çıkıyor!',
    'Efsane! {name} hiçbir eli kaçırmadı, KING!',
  ],
};

function pick(pool, avoid) {
  const options = pool.filter((t) => t !== avoid);
  const list = options.length > 0 ? options : pool;
  return list[Math.floor(Math.random() * list.length)];
}

export function funMessage(category, { name, points }, avoidText) {
  const pool = POOLS[category];
  if (!pool) return null;
  const template = pick(pool, avoidText);
  return template.replace(/{name}/g, name).replace(/{points}/g, Math.abs(points));
}
