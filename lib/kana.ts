// Таблица каны для тренажёра (хирагана и катакана, основные ряды и с дакутэном).
export const ROWS: [string, string, string, string][] = [
  ['a', 'あいうえお', 'アイウエオ', 'a i u e o'], ['k', 'かきくけこ', 'カキクケコ', 'ka ki ku ke ko'], ['s', 'さしすせそ', 'サシスセソ', 'sa shi su se so'],
  ['t', 'たちつてと', 'タチツテト', 'ta chi tsu te to'], ['n', 'なにぬねの', 'ナニヌネノ', 'na ni nu ne no'], ['h', 'はひふへほ', 'ハヒフヘホ', 'ha hi fu he ho'],
  ['m', 'まみむめも', 'マミムメモ', 'ma mi mu me mo'], ['y', 'や_ゆ_よ', 'ヤ_ユ_ヨ', 'ya _ yu _ yo'], ['r', 'らりるれろ', 'ラリルレロ', 'ra ri ru re ro'],
  ['w', 'わ___を', 'ワ___ヲ', 'wa _ _ _ wo'], ['nn', 'ん____', 'ン____', 'n _ _ _ _'],
  ['g', 'がぎぐげご', 'ガギグゲゴ', 'ga gi gu ge go'], ['z', 'ざじずぜぞ', 'ザジズゼゾ', 'za ji zu ze zo'], ['d', 'だぢづでど', 'ダヂヅデド', 'da ji zu de do'],
  ['b', 'ばびぶべぼ', 'バビブベボ', 'ba bi bu be bo'], ['p', 'ぱぴぷぺぽ', 'パピプペポ', 'pa pi pu pe po'],
];
export const BASE_ROWS = ['a', 'k', 's', 't', 'n', 'h', 'm', 'y', 'r', 'w', 'nn'];
export const DAK_ROWS = ['g', 'z', 'd', 'b', 'p'];
export type Kana = { c: string; r: string; s: 'hira' | 'kata'; row: string; p: string };
export const KANA: Kana[] = [];
for (const [row, h, k, r] of ROWS) {
  const hs = [...h], ks = [...k], rs = r.split(' ');
  hs.forEach((c, i) => { if (c === '_') return; KANA.push({ c, r: rs[i], s: 'hira', row, p: ks[i] }, { c: ks[i], r: rs[i], s: 'kata', row, p: c }); });
}
export const KANA_SET = new Set(KANA.map(k => k.c));
export const ALT: Record<string, string[]> = { shi: ['si'], chi: ['ti'], tsu: ['tu'], fu: ['hu'], ji: ['zi', 'di'], zu: ['du'], wo: ['o'], n: ['nn'] };
