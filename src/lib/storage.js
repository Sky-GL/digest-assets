const KEY = 'devanagari-quest-v1'
const CURRENT_VERSION = 2 // v2: カリキュラムを「代表音を先に一巡→深掘り」の五十音方式に再編(Step構成が変わったため)

export const emptyProgress = () => ({
  version: CURRENT_VERSION,
  xp: 0,
  unlockedStep: 1,
  steps: {},   // { [step]: { cleared, bestScore, stars, plays } }
  chars: {},   // { [id]: { correct, wrong, lastSeen, streak } }
  streak: { count: 0, lastDate: null },
  bestCombo: 0,
  curriculumMigrated: false, // v1→v2でStep進捗をリセットしたことを一度だけ通知するためのフラグ
})

export const loadProgress = () => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyProgress()
    const parsed = JSON.parse(raw)
    const merged = { ...emptyProgress(), ...parsed }

    if ((parsed.version || 1) < CURRENT_VERSION) {
      // カリキュラム再編でStep番号の意味が変わったため、Step関連だけリセットする。
      // 文字ごとの正誤統計(chars)はcharId基準で変わらないので引き継ぐ。
      return {
        ...merged,
        version: CURRENT_VERSION,
        unlockedStep: 1,
        steps: {},
        curriculumMigrated: true,
      }
    }
    return merged
  } catch {
    return emptyProgress()
  }
}

/** 移行通知バナーを閉じた後に呼び、二度と出さないようにする */
export const acknowledgeMigration = (progress) => ({ ...progress, curriculumMigrated: false })

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
