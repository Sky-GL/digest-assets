import data from './devanagari-data.json'

/**
 * Step ごとのメタ情報(タイトル・テーマ色・攻略メモ)。
 *
 * 五十音の「あいうえお→かさたなはまやらわ→濁音/半濁音/拗音」のように、
 * (1) 母音の基本形 (2) その長音・複合 (3) 子音の代表音を行を横断して一巡
 * (4)〜(8) 各行の有気音・濁音・鼻音を「代表音との重ね比較」付きで深掘り、
 * という順で組んである。
 */
export const STEPS = [
  { step: 1, title: '母音(基本)',       subtitle: '「あいうえお」に相当', emoji: '🌱', color: '#4ade80', tip: 'まずはこの5つだけ。अ は「口を開かないア」。' },
  { step: 2, title: '母音(長音・複合)', subtitle: '基本形に線が増えるだけ', emoji: '🌿', color: '#22d3ee', tip: 'カード下の「重ね比較」で、基本形からどこが増えたかが光って見える。' },
  { step: 3, title: '特殊母音記号',      subtitle: '点と2点',              emoji: '✨', color: '#a78bfa', tip: '点(ं)は鼻に抜く、2点(ः)は息を添える。' },
  { step: 4, title: '子音・代表音一巡', subtitle: '★「かさたなはまやらわ」に相当', emoji: '👑', color: '#fbbf24', tip: '各行の基本の子音を1つずつ、五十音のように一気に一巡する。ここが最初の山場。' },
  { step: 5, title: 'क行の深掘り',      subtitle: '喉の奥 k/g/kh/gh',      emoji: '🔥', color: '#fb923c', tip: 'क に息や濁りを足していく。カード下でक との重ね比較を見て関連づける。' },
  { step: 6, title: 'च行の深掘り',      subtitle: 'ch/j',                 emoji: '⚡', color: '#facc15', tip: 'क行と同じパターン。च に息や濁りを足すだけ。' },
  { step: 7, title: 'ट行の深掘り',      subtitle: 'そり舌・最難関',        emoji: '🐍', color: '#f43f5e', tip: 'ट に息や濁りを足す。歯音の ट行 と t行 は「重ね比較」で形からも区別する。' },
  { step: 8, title: 'त行の深掘り',      subtitle: '日本語に近い歯音',      emoji: '🦷', color: '#60a5fa', tip: 'त に息や濁りを足す。न はStep4で既に覚えている。' },
  { step: 9, title: 'प行+摩擦音の深掘り', subtitle: 'p/b/bh + そり舌のsh', emoji: '👄', color: '#f472b6', tip: 'प に息や濁りを足す。ここで全子音が出そろう。' },
  { step: 10, title: 'マートラ(母音記号)', subtitle: '★最重要 — 単語が読める', emoji: '📖', color: '#fbbf24', tip: 'ि は左に書いて後ろで読む。ここを越えると単語が読めるようになる。' },
  { step: 11, title: '頻出結合文字',      subtitle: 'ラスボス',             emoji: '🏆', color: '#e879f9', tip: '2つの子音が合体した形。よく見ると元の字が隠れている。' },
]

export const ALL_CHARS = data.characters

// マートラ・結合文字の Step 番号(他ファイルからのハードコード参照をここに集約)
export const MATRA_STEP = STEPS.find((s) => s.title.startsWith('マートラ')).step
export const CONJUNCT_STEP = STEPS[STEPS.length - 1].step

export const charsOfStep = (step) => ALL_CHARS.filter((c) => c.step === step)
export const charById = (id) => ALL_CHARS.find((c) => c.id === id)
export const stepMeta = (step) => STEPS.find((s) => s.step === step)
export const LAST_STEP = STEPS[STEPS.length - 1].step

// マートラ練習で使う子音(書きやすく頻出のもの)
export const MATRA_BASE_IDS = ['ka', 'ga', 'ca', 'ja', 'ta', 'da', 'na', 'pa', 'ba', 'ma', 'ra', 'la', 'sa', 'ha']

// 子音の行カナ [ア段, イ段, ウ段, エ段, オ段]。音節合成時のカナ近似に使う。
const CONSONANT_ROW_KANA = {
  ka: ['カ', 'キ', 'ク', 'ケ', 'コ'],
  ga: ['ガ', 'ギ', 'グ', 'ゲ', 'ゴ'],
  ca: ['チャ', 'チ', 'チュ', 'チェ', 'チョ'],
  ja: ['ジャ', 'ジ', 'ジュ', 'ジェ', 'ジョ'],
  ta: ['タ', 'ティ', 'トゥ', 'テ', 'ト'],
  da: ['ダ', 'ディ', 'ドゥ', 'デ', 'ド'],
  na: ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'],
  pa: ['パ', 'ピ', 'プ', 'ペ', 'ポ'],
  ba: ['バ', 'ビ', 'ブ', 'ベ', 'ボ'],
  ma: ['マ', 'ミ', 'ム', 'メ', 'モ'],
  ra: ['ラ', 'リ', 'ル', 'レ', 'ロ'],
  la: ['ラ', 'リ', 'ル', 'レ', 'ロ'],
  sa: ['サ', 'シ', 'ス', 'セ', 'ソ'],
  ha: ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'],
}

// マートラごとのカナ変換ルール(行カナ配列 → 音節カナ)
const MATRA_KANA_RULE = {
  m_aa: (row) => row[0] + 'ー',
  m_i: (row) => row[1],
  m_ii: (row) => row[1] + 'ー',
  m_u: (row) => row[2],
  m_uu: (row) => row[2] + 'ー',
  m_ri: (row) => row[2] + 'リ',
  m_e: (row) => row[3] + 'ー',
  m_ai: (row) => row[3] + 'ァー',
  m_o: (row) => row[4] + 'ー',
  m_au: (row) => row[4] + 'ァー',
  m_am: (row) => row[0] + 'ン',
  m_ah: (row) => row[0] + 'ハ',
}

/**
 * 子音 + マートラ の音節を組み立てる。
 * 通常のマートラは固有母音 a を置き換えるが、
 * アヌスヴァーラ(ं)/ヴィサルガ(ः)は a を残すので ka + ṃ = kaṃ となる。
 * kana はカタカナ近似(MATRA_BASE_IDS の子音のみ対応、それ以外は null)。
 */
export const syllable = (base, matra) => {
  const row = CONSONANT_ROW_KANA[base.id]
  const rule = MATRA_KANA_RULE[matra.id]
  return {
    devanagari: base.devanagari + matra.devanagari,
    iast: matra.keepInherent ? base.iast + matra.iast : base.iast.replace(/a$/, '') + matra.iast,
    kana: row && rule ? rule(row) : null,
  }
}
