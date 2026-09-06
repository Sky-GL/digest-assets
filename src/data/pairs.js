import { charById, syllable } from './steps'

/**
 * 見比べペア。a を下敷きにして b を重ね、「どこが増えたか/消えたか」を可視化する。
 * kind: length=短音→長音 / matra=マートラの長短 / lookalike=形がそっくり
 * 長短ペアは必ず a=短(基準), b=長(派生) の向きで書く(増えた部分が光るように)。
 */
export const PAIRS = [
  // ---- 母音の長短・派生 ----
  { a: 'a',  b: 'aa', kind: 'length', note: 'अ の右に縦棒が1本増えるだけ。この縦棒が「伸ばす」印。' },
  { a: 'i',  b: 'ii', kind: 'length', note: '下の輪はほぼ共通。上に出る飾りの向きと長さで見分ける。' },
  { a: 'u',  b: 'uu', kind: 'length', note: 'उ の下に、もう1本尾が伸びる。' },
  { a: 'e',  b: 'ai', kind: 'length', note: '上に付く斜め線が1本 → 2本になる。' },
  { a: 'o',  b: 'au', kind: 'length', note: '上に付く斜め線が1本 → 2本になる。' },
  { a: 'aa', b: 'o',  kind: 'length', note: 'आ の上に斜め線が1本増えると ओ。母音は形が積み上がっていく。' },

  // ---- マートラの長短(子音 क に付けた状態で比較) ----
  { a: 'm_i', b: 'm_ii', kind: 'matra', note: '形はほぼ鏡写し。短い ि は子音の左、長い ी は右に置く。書く位置で見分ける。' },
  { a: 'm_u', b: 'm_uu', kind: 'matra', note: '下の鉤が下へ長く伸びると長音。' },
  { a: 'm_e', b: 'm_ai', kind: 'matra', note: '上の線が1本 → 2本。単独母音 ए/ऐ と同じ理屈。' },
  { a: 'm_o', b: 'm_au', kind: 'matra', note: '上の線が1本 → 2本。単独母音 ओ/औ と同じ理屈。' },

  // ---- そっくりで間違えやすい字 ----
  { a: 'va',  b: 'ba',   kind: 'lookalike', note: 'ब は व の輪の中に短い横棒が1本入る。それ以外は同じ形。' },
  { a: 'gha', b: 'dha',  kind: 'lookalike', note: '音は /gʰ/ と /dʰ/ で別物。左半分の形で見分ける。' },
  { a: 'tta', b: 'ttha', kind: 'lookalike', note: 'ठ は輪が閉じて丸くなる。どちらもそり舌音。' },
  { a: 'dda', b: 'ddha', kind: 'lookalike', note: 'ढ には ड に無い線が加わる。どちらもそり舌音。' },
  { a: 'ma',  b: 'bha',  kind: 'lookalike', note: '右の縦線から先はよく似ている。左側の形が決め手。' },
  { a: 'sha', b: 'ssha', kind: 'lookalike', note: '現代ヒンディー語ではほぼ同じ音。形だけで見分ける。' },

  // ---- そり舌音 vs 歯音(音の最難関ペア。形も別物だと確認する) ----
  { a: 'ta', b: 'tta', kind: 'lookalike', note: '歯音 त とそり舌 ट。形は全く別。まず形で確実に区別し、音の違いに集中する。' },
  { a: 'da', b: 'dda', kind: 'lookalike', note: '歯音 द とそり舌 ड。形は全く別。' },
  { a: 'na', b: 'nna', kind: 'lookalike', note: '歯音 न とそり舌 ण。ण は語頭に来ない。' },
]

/** その文字が関わる比較ペアを、文字オブジェクト付きで返す */
export const pairsOf = (charId) =>
  PAIRS.filter((p) => p.a === charId || p.b === charId).map((p) => ({
    ...p,
    id: `${p.a}-${p.b}`,
    charA: charById(p.a),
    charB: charById(p.b),
  }))

/** 2文字ぶんのペアを直接引く(クイズの誤答表示用。向きは問わない) */
export const findPair = (idA, idB) =>
  PAIRS.find((p) => (p.a === idA && p.b === idB) || (p.a === idB && p.b === idA))

/**
 * 比較で実際に描画する見た目。
 * マートラは単体だと形が分かりにくいので、子音 क に付けた音節で見せる。
 */
export const diffFace = (char) => {
  if (char.group === 'matra') {
    const s = syllable(charById('ka'), char)
    return { text: s.devanagari, read: `${s.iast} / ${s.kana || char.kana}` }
  }
  return { text: char.devanagari, read: `${char.iast} / ${char.kana}` }
}
