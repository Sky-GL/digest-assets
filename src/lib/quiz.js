import { charsOfStep, ALL_CHARS, MATRA_BASE_IDS, charById, syllable } from '../data/steps'
import { weightedPick } from './srs'

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// マートラは単独母音と読みが同じなので束縛形(-ā)として区別する
const label = (c) => (c.group === 'matra' ? `-${c.iast} ${c.ipa}` : `${c.iast} ${c.ipa}`)

// ダミー選択肢は同じグループ優先(似ているほど良問になる)
const distractors = (target, pool, n = 3) => {
  const same = pool.filter((c) => c.id !== target.id && c.group === target.group)
  const other = pool.filter((c) => c.id !== target.id && c.group !== target.group)
  return shuffle(same).slice(0, n).concat(shuffle(other)).slice(0, n)
}

const makeChoiceQ = (target, pool, direction) => {
  const wrongs = distractors(target, pool)
  const options = shuffle([target, ...wrongs])
  if (direction === 'char2read') {
    return {
      kind: 'char2read',
      charId: target.id,
      prompt: target.display || target.devanagari,
      promptSub: 'この文字の読みは?',
      speakChar: target,
      options: options.map((o) => ({ id: o.id, text: label(o) })),
      answerId: target.id,
      explain: target.note,
    }
  }
  return {
    kind: 'read2char',
    charId: target.id,
    prompt: label(target),
    promptSub: 'この読みの文字は?',
    speakChar: target,
    options: options.map((o) => ({ id: o.id, text: o.display || o.devanagari, big: true })),
    answerId: target.id,
    explain: target.note,
  }
}

// Step12専用: 子音 + マートラ = 読み の組み合わせ問題
const makeMatraQ = () => {
  const matras = charsOfStep(12)
  const matra = matras[Math.floor(Math.random() * matras.length)]
  const base = charById(MATRA_BASE_IDS[Math.floor(Math.random() * MATRA_BASE_IDS.length)])
  const { devanagari: combined, iast: correct } = syllable(base, matra)

  const wrongMatras = shuffle(matras.filter((m) => m.id !== matra.id)).slice(0, 3)
  const options = shuffle([
    { id: matra.id, text: correct },
    ...wrongMatras.map((m) => ({ id: m.id, text: syllable(base, m).iast })),
  ])

  return {
    kind: 'matra',
    charId: matra.id,
    prompt: combined,
    promptSub: `${base.devanagari} + ${matra.display || matra.devanagari} = ?`,
    speakText: combined,
    options,
    answerId: matra.id,
    explain: `${base.devanagari}(${base.iast}) + ${matra.display || matra.devanagari}(${matra.iast}) = ${correct} — ${matra.note}`,
  }
}

/** Stepクリア用クイズを生成(文字→発音 と 発音→文字 の双方向) */
export const buildStepQuiz = (step, stats = {}, count = 10) => {
  const chars = charsOfStep(step)
  const pool = chars.length >= 4 ? chars : ALL_CHARS.filter((c) => c.step <= step)

  if (step === 12) {
    // マートラは組み合わせ問題を重点出題(6割)
    const qs = []
    const n = Math.max(count, 12)
    for (let i = 0; i < n; i++) {
      if (i % 5 < 3) qs.push(makeMatraQ())
      else {
        const t = weightedPick(chars, stats, chars.length)[i % chars.length]
        qs.push(makeChoiceQ(t, pool, i % 2 ? 'char2read' : 'read2char'))
      }
    }
    return shuffle(qs)
  }

  const targets = []
  const picked = weightedPick(chars, stats, chars.length)
  while (targets.length < Math.max(count, chars.length)) {
    targets.push(...picked)
  }
  return targets
    .slice(0, Math.max(count, chars.length))
    .map((t, i) => makeChoiceQ(t, pool, i % 2 ? 'char2read' : 'read2char'))
}

/** 復習モード用: 学習済み範囲から誤答優先で出題 */
export const buildReviewQuiz = (unlockedStep, stats = {}, count = 12) => {
  const learned = ALL_CHARS.filter((c) => c.step <= unlockedStep)
  const targets = weightedPick(learned, stats, Math.min(count, learned.length))
  return shuffle(
    targets.map((t, i) =>
      t.step === 12 && i % 2 === 0 ? makeMatraQ() : makeChoiceQ(t, learned, i % 2 ? 'char2read' : 'read2char')
    )
  )
}

export { shuffle }
