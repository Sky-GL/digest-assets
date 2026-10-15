// ポップ専用の進捗(本編の進捗とは独立)。Lvは遊んだ量の目安(出現する文字には影響しない)。
const KEY = 'devanagari-pop-v1'

// mode: 'read'=文字面+読み面のペアで合体(読む練習) / 'normal'=同じ文字どうしが合体(元のかなポップ)
const empty = () => ({ level: 1, exp: 0, best: {}, cleared: {}, mode: 'read' })

/** ベスト/クリア記録のキー。モードごとに別々に持つ(読みモードは 'r1','r2'… / ふつうは 1,2…) */
export const recordKey = (mode, stage) => (mode === 'read' ? `r${stage}` : stage)

export const loadPop = () => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (p && Number.isFinite(p.level) && p.level >= 1 && Number.isFinite(p.exp) && p.exp >= 0) {
      return { ...empty(), ...p, level: Math.min(p.level, 99) }
    }
  } catch {
    /* 壊れていたら初期化 */
  }
  return empty()
}

export const savePop = (p) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* 保存不可でも遊べる */
  }
}

export const expToNext = (level) => 100 + (level - 1) * 90

/** 経験値を加算。{ next, gained(上がったLv数) } を返す(保存は呼び出し側) */
export const addExp = (p, amount) => {
  let { level, exp } = p
  exp += amount
  let gained = 0
  while (level < 99 && exp >= expToNext(level)) {
    exp -= expToNext(level)
    level += 1
    gained += 1
  }
  return { next: { ...p, level, exp }, gained }
}

export const recordBest = (p, stage, score) =>
  score > (p.best[stage] || 0) ? { ...p, best: { ...p.best, [stage]: score } } : p

export const markCleared = (p, stage) => (p.cleared[stage] ? p : { ...p, cleared: { ...p.cleared, [stage]: true } })
