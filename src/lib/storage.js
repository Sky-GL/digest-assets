const KEY = 'devanagari-quest-v1'

export const emptyProgress = () => ({
  version: 1,
  xp: 0,
  unlockedStep: 1,
  steps: {},   // { [step]: { cleared, bestScore, stars, plays } }
  chars: {},   // { [id]: { correct, wrong, lastSeen, streak } }
  streak: { count: 0, lastDate: null },
  bestCombo: 0,
})

export const loadProgress = () => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyProgress()
    const parsed = JSON.parse(raw)
    return { ...emptyProgress(), ...parsed }
  } catch {
    return emptyProgress()
  }
}

export const saveProgress = (p) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* 保存不可でも学習は続行できる */
  }
}

export const clearProgress = () => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}

// 連続学習日数の更新(日付が変わったらカウント)
export const touchStreak = (streak) => {
  const today = new Date().toISOString().slice(0, 10)
  if (streak.lastDate === today) return streak
  const yst = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  return { count: streak.lastDate === yst ? streak.count + 1 : 1, lastDate: today }
}
