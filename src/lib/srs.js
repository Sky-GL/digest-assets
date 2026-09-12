// 簡易スペースドリペティション: 誤答が多い/久しく見ていない文字ほど優先度を上げる

export const charScore = (stat) => {
  if (!stat) return 3 // 未学習は高めの優先度
  const { correct = 0, wrong = 0, lastSeen = 0 } = stat
  const errorRate = (wrong + 0.5) / (correct + wrong + 1)
  const days = lastSeen ? (Date.now() - lastSeen) / 86400000 : 30
  const recency = Math.min(days, 30) / 30 // 0〜1
  return errorRate * 6 + recency * 2 + (wrong > 0 ? 1 : 0)
}

// 重み付きサンプリング(重複なし)
export const weightedPick = (chars, stats, n) => {
  const pool = chars.map((c) => ({ c, w: charScore(stats[c.id]) + Math.random() * 0.8 }))
  pool.sort((a, b) => b.w - a.w)
  return pool.slice(0, n).map((x) => x.c)
}

// 復習対象(誤答したことがある or 未学習)を優先度順に
export const reviewQueue = (chars, stats) =>
  chars
    .map((c) => ({ c, score: charScore(stats[c.id]) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c)
