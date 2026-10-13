import { charById, syllable } from './steps'

// ポップ(マージゲーム)のステージ定義。元の「かなポップ」と同じく1ステージ=5文字(あいうえお/かきくけこ…)で、
// 小さい文字→大きい文字の順に進化する。5文字なのは、ステージクリアに「最終形を16個」必要とするため
// (最終形+最終形→👑、👑+👑→💎、💎+💎→🌈、🌈+🌈→クリア)。文字数が多いと必要な数が倍々で増えてクリアできなくなる。
// デーヴァナーガリーは各行(क ख ग घ ङ など)がちょうど5文字なので、そのまま1ステージにできる。
// base は各レベルのメダルのアクセント色(スチール→シアン→紫→橙→金)。隣り合うレベルで色相が大きく変わる。

const COLORS = ['#a5b4c4', '#38d0f0', '#a070ff', '#ff9a2e', '#ffd966']

const MIN_R = 30
const MAX_R = 56

// レベル0〜n-1 の半径を等比で補間(最小30→最大56)
const radiusOf = (level, count) =>
  count <= 1 ? MIN_R : Math.round(MIN_R * Math.pow(MAX_R / MIN_R, level / (count - 1)))

const fromIds = (ids) =>
  ids.map((id) => {
    const c = charById(id)
    return { glyph: c.devanagari, label: c.iast, speak: c.speak || c.devanagari }
  })

// 子音 + マートラの音節(例: क + ा = का)
const syllables = (baseId, matraIds) =>
  matraIds.map((mid) => {
    const s = syllable(charById(baseId), charById(mid))
    return { glyph: s.devanagari, label: s.iast, speak: s.devanagari }
  })

const RAW = [
  { title: '母音①', subtitle: 'अ आ इ ई उ', items: fromIds(['a', 'aa', 'i', 'ii', 'u']) },
  { title: '母音②', subtitle: 'ऊ ए ऐ ओ औ', items: fromIds(['uu', 'e', 'ai', 'o', 'au']) },
  { title: 'क行', subtitle: '喉の奥の音', items: fromIds(['ka', 'kha', 'ga', 'gha', 'nga']) },
  { title: 'च行', subtitle: '口蓋の音', items: fromIds(['ca', 'cha', 'ja', 'jha', 'nya']) },
  { title: 'ट行', subtitle: 'そり舌の音', items: fromIds(['tta', 'ttha', 'dda', 'ddha', 'nna']) },
  { title: 'त行', subtitle: '歯の音', items: fromIds(['ta', 'tha', 'da', 'dha', 'na']) },
  { title: 'प行', subtitle: '唇の音', items: fromIds(['pa', 'pha', 'ba', 'bha', 'ma']) },
  { title: '半母音', subtitle: 'य र ल व श', items: fromIds(['ya', 'ra', 'la', 'va', 'sha']) },
  { title: '摩擦音', subtitle: 'ष स ह अं अः', items: fromIds(['ssha', 'sa', 'ha', 'am', 'ah']) },
  { title: '結合文字', subtitle: 'क्ष त्र ज्ञ श्र ऋ', items: fromIds(['ksha', 'tra', 'gya', 'shra', 'ri']) },
  { title: 'マートラ①', subtitle: 'क + ा ि ी ु ू', items: syllables('ka', ['m_aa', 'm_i', 'm_ii', 'm_u', 'm_uu']) },
  { title: 'マートラ②', subtitle: 'क + ृ े ै ो ौ', items: syllables('ka', ['m_ri', 'm_e', 'm_ai', 'm_o', 'm_au']) },
]

export const POP_STAGES = RAW.map((s, i) => ({
  id: i + 1,
  title: s.title,
  subtitle: s.subtitle,
  chars: s.items.map((it, level) => ({
    ...it,
    level,
    radius: radiusOf(level, s.items.length),
    base: COLORS[level % COLORS.length],
  })),
}))

export const popStage = (id) => POP_STAGES[Math.max(0, Math.min(POP_STAGES.length - 1, id - 1))]

// "#RRGGBB" を明るく(t>0)/暗く(t<0)する。メダルのグラデーション用
export const shade = (hex, t) => {
  const n = parseInt(hex.slice(1), 16)
  const f = (v) => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t))
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`
}

// "#RRGGBB" + 透明度 → rgba文字列(発光・縁取り用)
export const withAlpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
