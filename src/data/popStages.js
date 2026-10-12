import { charById, syllable } from './steps'

// ポップ(マージゲーム)のステージ定義。1ステージ=10文字で、小さい文字→大きい文字の順に進化する。
// base は各レベルのメダルのアクセント色。隣り合うレベルで色相が大きく変わるようにして見分けやすくしてある
// (スチール→シアン→青→紫→緑→黄→橙→赤→マゼンタ→金)。
// 並びは伝統的なヴァルナマーラー(子音表)の順。

const COLORS = ['#a5b4c4', '#38d0f0', '#4f7cff', '#a070ff', '#3ddc84', '#f2d03b', '#ff9a2e', '#ff4d4d', '#e0409a', '#ffd966']

const MIN_R = 26
const MAX_R = 116

// レベル0〜n-1 の半径を等比で補間(最小26→最大116)
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
  { title: '母音', subtitle: '短い・長い・複合', items: fromIds(['a', 'aa', 'i', 'ii', 'u', 'uu', 'e', 'ai', 'o', 'au']) },
  { title: 'क行・च行', subtitle: '喉の奥と口蓋', items: fromIds(['ka', 'kha', 'ga', 'gha', 'nga', 'ca', 'cha', 'ja', 'jha', 'nya']) },
  { title: 'ट行・त行', subtitle: 'そり舌と歯', items: fromIds(['tta', 'ttha', 'dda', 'ddha', 'nna', 'ta', 'tha', 'da', 'dha', 'na']) },
  { title: 'प行・半母音', subtitle: '唇・半母音・श', items: fromIds(['pa', 'pha', 'ba', 'bha', 'ma', 'ya', 'ra', 'la', 'va', 'sha']) },
  { title: '摩擦音・結合', subtitle: 'ष स ह と結合文字', items: fromIds(['ssha', 'sa', 'ha', 'ri', 'am', 'ah', 'ksha', 'tra', 'gya', 'shra']) },
  { title: 'マートラ', subtitle: 'क に母音記号をつける', items: syllables('ka', ['m_aa', 'm_i', 'm_ii', 'm_u', 'm_uu', 'm_ri', 'm_e', 'm_ai', 'm_o', 'm_au']) },
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
