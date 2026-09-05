import data from './devanagari-data.json'

// Step ごとのメタ情報(タイトル・テーマ色・攻略メモ)
export const STEPS = [
  { step: 1,  title: '母音(短)',        subtitle: 'まずは3つだけ',       emoji: '🌱', color: '#4ade80', tip: 'ヒンディー語の旅はここから。अ は「口を開かないア」。' },
  { step: 2,  title: '母音(長)',        subtitle: '短音とペアで覚える',   emoji: '🌿', color: '#22d3ee', tip: '短母音に線や尾が足されると長母音。形の差分に注目。' },
  { step: 3,  title: '母音(複合)',      subtitle: 'エー・オー系',         emoji: '🍃', color: '#38bdf8', tip: 'ऐ/औ は「アイ/アウ」ではなく口を広げた1音。' },
  { step: 4,  title: '特殊母音記号',      subtitle: '点と2点',              emoji: '✨', color: '#a78bfa', tip: '点(ं)は鼻に抜く、2点(ः)は息を添える。' },
  { step: 5,  title: '子音① 軟口蓋音',   subtitle: '喉の奥 k/g',           emoji: '🔥', color: '#fb923c', tip: '5つ1組のパターン(無気→有気→濁→濁有気→鼻音)を体で覚える。' },
  { step: 6,  title: '子音② 硬口蓋音',   subtitle: 'ch/j',                 emoji: '⚡', color: '#facc15', tip: 'Step5と同じ並び。位置が前に移るだけ。' },
  { step: 7,  title: '子音③ そり舌音',   subtitle: '最難関',               emoji: '🐍', color: '#f43f5e', tip: '舌先を上あごの奥に反らせる。Step8の歯音と聞き比べるのがコツ。' },
  { step: 8,  title: '子音④ 歯音',       subtitle: '日本語に近い',         emoji: '🦷', color: '#60a5fa', tip: '舌を上の歯の裏にべったり。日本語のタ行より前寄り。' },
  { step: 9,  title: '子音⑤ 唇音',       subtitle: 'p/b/m',                emoji: '👄', color: '#f472b6', tip: '5行目にして最後の五音組。ここまでで25文字制覇。' },
  { step: 10, title: '半母音',           subtitle: 'y/r/l/v',              emoji: '🌊', color: '#2dd4bf', tip: 'ボーナスステージ級に易しい。र の軽い巻き舌だけ意識。' },
  { step: 11, title: '摩擦音',           subtitle: 'sh/s/h',               emoji: '💨', color: '#c084fc', tip: 'श と ष は現代語ではほぼ同じ音。形で見分ける。' },
  { step: 12, title: 'マートラ(母音記号)', subtitle: '★最重要 — 単語が読める', emoji: '👑', color: '#fbbf24', tip: 'ि は左に書いて後ろで読む。ここを越えると単語が読めるようになる。' },
  { step: 13, title: '頻出結合文字',      subtitle: 'ラスボス',             emoji: '🏆', color: '#e879f9', tip: '2つの子音が合体した形。よく見ると元の字が隠れている。' },
]

export const ALL_CHARS = data.characters

export const charsOfStep = (step) => ALL_CHARS.filter((c) => c.step === step)
export const charById = (id) => ALL_CHARS.find((c) => c.id === id)
export const stepMeta = (step) => STEPS.find((s) => s.step === step)
export const LAST_STEP = STEPS[STEPS.length - 1].step

// マートラ練習で使う子音(書きやすく頻出のもの)
export const MATRA_BASE_IDS = ['ka', 'ga', 'ca', 'ja', 'ta', 'da', 'na', 'pa', 'ba', 'ma', 'ra', 'la', 'sa', 'ha']

/**
 * 子音 + マートラ の音節を組み立てる。
 * 通常のマートラは固有母音 a を置き換えるが、
 * アヌスヴァーラ(ं)/ヴィサルガ(ः)は a を残すので ka + ṃ = kaṃ となる。
 */
export const syllable = (base, matra) => ({
  devanagari: base.devanagari + matra.devanagari,
  iast: matra.keepInherent ? base.iast + matra.iast : base.iast.replace(/a$/, '') + matra.iast,
})
