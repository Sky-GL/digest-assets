import { charById, syllable } from './steps'

/**
 * 見比べペア。a を下敷きにして b を重ね、「どこが増えたか/消えたか」を可視化する。
 * kind: length=短音→長音 / matra=マートラの長短 / lookalike=形がそっくり
 * a=先に習う(基準)側、b=後で習う(新出)側の向きで統一する。
 * pairsOf() はこの向きを見て、b 側(後で習うほう)のカードでのみ比較を表示する。
 *
 * ここに載せるのは「実際に重ねると意味のある差分になる」ペアだけ。
 * デーヴァナーガリーは無声無気→無声有気→有声無気…の音の派生(क→ख→ग→घ など)が
 * 字形としては別デザインになることが多く、重ねても単なる色の混在にしかならない。
 * 採否は実測(重なり以外のピクセル比率)で判断した。目安: 0.3以下を採用。
 */
export const PAIRS = [
  // ---- 母音: 基本形 → 長音・複合(形に線が積み上がる) ----
  { a: 'a',  b: 'aa', kind: 'length', note: 'अ の右に縦棒が1本増えるだけ。この縦棒が「伸ばす」印。' },
  { a: 'i',  b: 'ii', kind: 'length', note: '下の輪はほぼ共通。上に出る飾りの向きと長さで見分ける。' },
  { a: 'u',  b: 'uu', kind: 'length', note: 'उ の下に、もう1本尾が伸びる。' },
  { a: 'e',  b: 'ai', kind: 'length', note: 'ए の上に付く斜め線が1本 → 2本になると ऐ。' },
  { a: 'o',  b: 'au', kind: 'length', note: 'ओ の上に付く斜め線が1本 → 2本になると औ。' },

  // ---- マートラの長短(子音 क に付けた状態で比較) ----
  // m_i/m_ii(ि/ी)は書く位置が子音の左右で逆になるため、重ねても意味のある差分にならない。
  // これは note のテキストと表示位置(ि◌/◌ी)で伝える。
  { a: 'm_u', b: 'm_uu', kind: 'matra', note: '下の鉤が下へ長く伸びると長音。' },
  { a: 'm_e', b: 'm_ai', kind: 'matra', note: '上の線が1本 → 2本。単独母音 ए/ऐ と同じ理屈。' },
  { a: 'm_o', b: 'm_au', kind: 'matra', note: '上の線が1本 → 2本。単独母音 ओ/औ と同じ理屈。' },

  // ---- そっくりで間違えやすい字(重ねると実際に共通部分が見える字のみ) ----
  { a: 'va',   b: 'ba',   kind: 'lookalike', note: 'ब は व の輪の中に短い横棒が1本入る。それ以外は同じ形。' },
  { a: 'gha',  b: 'dha',  kind: 'lookalike', note: '音は /gʰ/ と /dʰ/ で別物。左半分の形で見分ける。' },
  { a: 'ma',   b: 'bha',  kind: 'lookalike', note: '右の縦線から先はよく似ている。左側の形が決め手。' },
  { a: 'tta',  b: 'ttha', kind: 'lookalike', note: 'ठ は縦棒の下の輪が閉じて丸くなる。どちらもそり舌音。' },
  { a: 'tta',  b: 'ddha', kind: 'lookalike', note: 'ढ には ट に無い丸みが加わる。そり舌音同士。' },
]

/**
 * その文字が関わる比較ペアを、文字オブジェクト付きで返す。
 * 「後で習うほう(step が大きいほう)」のカードでのみ返す。
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
