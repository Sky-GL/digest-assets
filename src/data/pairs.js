import { charById, syllable } from './steps'

/**
 * 見比べペア。a を下敷きにして b を重ね、「どこが増えたか/消えたか」を可視化する。
 * kind: length=短音→長音 / matra=マートラの長短 / derived=代表音→有気音・濁音・鼻音 / lookalike=形がそっくり
 * a=先に習う(基準)側、b=後で習う(派生・新出)側の向きで統一する。
 * pairsOf() はこの向きを見て、b 側(後で習うほう)のカードでのみ比較を表示する。
 */
export const PAIRS = [
  // ---- 母音: 基本形 → 長音・複合(形に線が積み上がる) ----
  { a: 'a',  b: 'aa', kind: 'length', note: 'अ の右に縦棒が1本増えるだけ。この縦棒が「伸ばす」印。' },
  { a: 'i',  b: 'ii', kind: 'length', note: '下の輪はほぼ共通。上に出る飾りの向きと長さで見分ける。' },
  { a: 'u',  b: 'uu', kind: 'length', note: 'उ の下に、もう1本尾が伸びる。' },
  { a: 'e',  b: 'ai', kind: 'length', note: 'ए の上に付く斜め線が1本 → 2本になると ऐ。' },
  { a: 'o',  b: 'au', kind: 'length', note: 'ओ の上に付く斜め線が1本 → 2本になると औ。' },

  // ---- マートラの長短(子音 क に付けた状態で比較) ----
  { a: 'm_i', b: 'm_ii', kind: 'matra', note: '形はほぼ鏡写し。短い ि は子音の左、長い ी は右に置く。書く位置で見分ける。' },
  { a: 'm_u', b: 'm_uu', kind: 'matra', note: '下の鉤が下へ長く伸びると長音。' },
  { a: 'm_e', b: 'm_ai', kind: 'matra', note: '上の線が1本 → 2本。単独母音 ए/ऐ と同じ理屈。' },
  { a: 'm_o', b: 'm_au', kind: 'matra', note: '上の線が1本 → 2本。単独母音 ओ/औ と同じ理屈。' },

  // ---- 子音: 代表音(Step4) → 有気音・濁音・鼻音(Step5〜9) ----
  // क行
  { a: 'ka', b: 'kha', kind: 'derived', note: 'क に強い息を足すと ख。形も右側に線が増える。' },
  { a: 'ka', b: 'ga',  kind: 'derived', note: 'क を有声化(喉を鳴らす)すると ग。' },
  { a: 'ka', b: 'gha', kind: 'derived', note: 'ग にさらに息を足すと घ。क行はこれで完成。' },
  // च行
  { a: 'ca', b: 'cha', kind: 'derived', note: 'च に強い息を足すと छ。' },
  { a: 'ca', b: 'ja',  kind: 'derived', note: 'च を有声化すると ज。' },
  { a: 'ca', b: 'jha', kind: 'derived', note: 'ज にさらに息を足すと झ。च行はこれで完成。' },
  // ट行(そり舌)
  { a: 'tta', b: 'ttha', kind: 'derived', note: 'ट に強い息を足すと ठ。' },
  { a: 'tta', b: 'dda',  kind: 'derived', note: 'ट を有声化すると ड。' },
  { a: 'tta', b: 'ddha', kind: 'derived', note: 'ड にさらに息を足すと ढ。ट行はこれで完成。' },
  // त行(歯)
  { a: 'ta', b: 'tha', kind: 'derived', note: 'त に強い息を足すと थ。' },
  { a: 'ta', b: 'da',  kind: 'derived', note: 'त を有声化すると द。' },
  { a: 'ta', b: 'dha', kind: 'derived', note: 'द にさらに息を足すと ध。त行はこれで完成(न はStep4で既出)。' },
  // प行
  { a: 'pa', b: 'pha', kind: 'derived', note: 'प に強い息を足すと फ。' },
  { a: 'pa', b: 'ba',  kind: 'derived', note: 'प を有声化すると ब。' },
  { a: 'pa', b: 'bha', kind: 'derived', note: 'ब にさらに息を足すと भ。प行はこれで完成(म はStep4で既出)。' },
  // 摩擦音の残り
  { a: 'sha', b: 'ssha', kind: 'derived', note: 'श を舌をそり上げて言うと ष。現代語ではほぼ同じ音。' },

  // ---- そっくりで間違えやすい字(そり舌 vs 歯、形が似た別音) ----
  { a: 'va',  b: 'ba',   kind: 'lookalike', note: 'ब は व の輪の中に短い横棒が1本入る。それ以外は同じ形。' },
  { a: 'gha', b: 'dha',  kind: 'lookalike', note: '音は /gʰ/ と /dʰ/ で別物。左半分の形で見分ける。' },
  { a: 'ma',  b: 'bha',  kind: 'lookalike', note: '右の縦線から先はよく似ている。左側の形が決め手。' },
  { a: 'ta',  b: 'tta',  kind: 'lookalike', note: '歯音 त とそり舌 ट。形は全く別。まず形で確実に区別し、音の違いに集中する。' },
  { a: 'da',  b: 'dda',  kind: 'lookalike', note: '歯音 द とそり舌 ड。形は全く別。' },
  { a: 'na',  b: 'nna',  kind: 'lookalike', note: '歯音 न とそり舌 ण。ण は語頭に来ない。' },
]

/**
 * その文字が関わる比較ペアを、文字オブジェクト付きで返す。
 * derived/lookalike は「後で習うほう(step が大きいほう)」のカードでのみ返す。
 * まだ習っていない文字を先出しして見せないための制御。
 */
export const pairsOf = (charId) => {
  const char = charById(charId)
  if (!char) return []
  return PAIRS.filter((p) => {
    if (p.a !== charId && p.b !== charId) return false
    const otherId = p.a === charId ? p.b : p.a
    const other = charById(otherId)
    if (!other) return false
    return char.step >= other.step
  }).map((p) => ({
    ...p,
    id: `${p.a}-${p.b}`,
    charA: charById(p.a),
    charB: charById(p.b),
  }))
}

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
