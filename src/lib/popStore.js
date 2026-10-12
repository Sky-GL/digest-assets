// ポップ専用の進捗(本編の進捗とは独立)。プレイヤーLvが上がると大きい文字が降ってくる。
const KEY = 'devanagari-pop-v1'

const empty = () => ({ level: 1, exp: 0, best: {}, cleared: {} })

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

export const expToNext = (level) => 40 + (level - 1) * 35

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

// 降ってくる文字の最大レベル(3〜5)。最初から4種類が降り、Lvが上がるほど大きい文字も混ざる
// (Lv1〜3:レベル0〜3 / Lv4〜6:〜4 / Lv7〜:〜5)
export const spawnTier = (level) => Math.min(5, 3 + Math.floor((level - 1) / 3))

/** 出現プール。小さい文字ほど多く入れて出やすくする(盤面が大きい文字で埋まりすぎないように) */
export const spawnPool = (level) => {
  const tier = spawnTier(level)
  const pool = []
  for (let i = 0; i <= tier; i++) {
    for (let k = 0; k < tier + 1 - i; k++) pool.push(i)
  }
  return pool
}

export const recordBest = (p, stage, score) =>
  score > (p.best[stage] || 0) ? { ...p, best: { ...p.best, [stage]: score } } : p

export const markCleared = (p, stage) => (p.cleared[stage] ? p : { ...p, cleared: { ...p.cleared, [stage]: true } })
