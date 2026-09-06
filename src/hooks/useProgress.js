import { useCallback, useEffect, useState } from 'react'
import { loadProgress, saveProgress, clearProgress, touchStreak, acknowledgeMigration } from '../lib/storage'
import { LAST_STEP } from '../data/steps'

export const XP_PER_LEVEL = 120
export const levelOf = (xp) => Math.floor(xp / XP_PER_LEVEL) + 1
export const levelProgress = (xp) => (xp % XP_PER_LEVEL) / XP_PER_LEVEL

export function useProgress() {
  const [progress, setProgress] = useState(() => {
    const p = loadProgress()
    return { ...p, streak: touchStreak(p.streak) }
  })

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  // 1問の解答結果を記録
  const recordAnswer = useCallback((charId, correct) => {
    setProgress((p) => {
      const prev = p.chars[charId] || { correct: 0, wrong: 0, lastSeen: 0 }
      return {
        ...p,
        xp: p.xp + (correct ? 10 : 2),
        chars: {
          ...p.chars,
          [charId]: {
            correct: prev.correct + (correct ? 1 : 0),
            wrong: prev.wrong + (correct ? 0 : 1),
            lastSeen: Date.now(),
          },
        },
      }
    })
  }, [])

  // Stepクイズ終了時の集計(正答率でスター判定、80%以上で次をアンロック)
  const finishStep = useCallback((step, score, total) => {
    const rate = total ? score / total : 0
    const stars = rate >= 1 ? 3 : rate >= 0.85 ? 2 : rate >= 0.7 ? 1 : 0
    const cleared = rate >= 0.8
    setProgress((p) => {
      const prev = p.steps[step] || { cleared: false, bestScore: 0, stars: 0, plays: 0 }
      const bonus = cleared && !prev.cleared ? 50 : 0
      return {
        ...p,
        xp: p.xp + bonus,
        unlockedStep: cleared ? Math.min(Math.max(p.unlockedStep, step + 1), LAST_STEP) : p.unlockedStep,
        steps: {
          ...p.steps,
          [step]: {
            cleared: prev.cleared || cleared,
            bestScore: Math.max(prev.bestScore, score),
            stars: Math.max(prev.stars, stars),
            plays: prev.plays + 1,
          },
        },
      }
    })
    return { cleared, stars, rate }
  }, [])

  const noteCombo = useCallback((combo) => {
    setProgress((p) => (combo > p.bestCombo ? { ...p, bestCombo: combo } : p))
  }, [])

  const reset = useCallback(() => {
    clearProgress()
    setProgress(() => {
      const fresh = loadProgress()
      return { ...fresh, streak: touchStreak(fresh.streak) }
    })
  }, [])

  const dismissMigration = useCallback(() => {
    setProgress((p) => acknowledgeMigration(p))
  }, [])

  return { progress, recordAnswer, finishStep, noteCombo, reset, dismissMigration }
}
