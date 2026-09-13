import { charsOfStep, ALL_CHARS, MATRA_BASE_IDS, MATRA_STEP, charById, syllable } from '../data/steps'
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

/**
 * 選択肢の「種類」。マートラは単独では立てない束縛形なので、
 * 独立字(母音・子音・結合文字)と混ぜてはいけない。
 * 混ざると ◌ी のような点線付きの形が子音の選択肢に並び、
 * 見た目で即座に除外できてしまう(= 問題として成立しない)。
 */
const unitOf = (c) => (c.group === 'matra' ? 'matra' : 'letter')

/**
 * ダミー選択肢を選ぶ。優先順位は
 *   1. 出題プール内の同じ種類・同じグループ(いちばん紛らわしい)
 *   2. 出題プール内の同じ種類
 *   3. 全文字から同じ種類
 * 学習済みが少ないうちは 1〜2 だけでは4択が埋まらないが、そこで種類をまたいで
 * 補うと独立字の問題にマートラが並んでしまう。ダミーは未学習の字でも構わないので、
 * プールを広げるより先に「同じ種類のまま全文字へ広げる」。
 */
const distractors = (target, pool, n = 3) => {
  const unit = unitOf(target)
  const take = (list) => list.filter((c) => c.id !== target.id && unitOf(c) === unit)
  const inPool = take(pool)
  const picked = shuffle(inPool.filter((c) => c.group === target.group))
    .concat(shuffle(inPool.filter((c) => c.group !== target.group)))
    .slice(0, n)
  if (picked.length >= n) return picked

  const usedIds = new Set([target.id, ...picked.map((c) => c.id)])
  const widened = take(ALL_CHARS).filter((c) => !usedIds.has(c.id))
  return picked
    .concat(shuffle(widened.filter((c) => c.group === target.group)))
    .concat(shuffle(widened.filter((c) => c.group !== target.group)))
    .slice(0, n)
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
    // マートラ(束縛形)は単独発音のカナ表記が誤解を招くため出さない
    promptKana: target.group === 'matra' ? null : target.kana,
    promptSub: 'この読みの文字は?',
    speakChar: target,
    options: options.map((o) => ({ id: o.id, text: o.display || o.devanagari, big: true })),
    answerId: target.id,
    explain: target.note,
  }
}

// マートラStep専用: 子音 + マートラ = 読み の組み合わせ問題
const makeMatraQ = () => {
  const matras = charsOfStep(MATRA_STEP)
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

  if (step === MATRA_STEP) {
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

/** 復習モード用: 実際に一度でも解答した文字(statsに記録がある文字)から誤答優先で出題 */
export const buildReviewQuiz = (stats = {}, count = 12) => {
  const learnedIds = new Set(Object.keys(stats))
  const learned = ALL_CHARS.filter((c) => learnedIds.has(c.id))
  if (learned.length === 0) return []
  const targets = weightedPick(learned, stats, Math.min(count, learned.length))
  return shuffle(
    targets.map((t, i) =>
      t.step === MATRA_STEP && i % 2 === 0 ? makeMatraQ() : makeChoiceQ(t, learned, i % 2 ? 'char2read' : 'read2char')
    )
  )
}

/**
 * 4択チャレンジ用の1問を作る。
 * Stepに縛られず、渡された文字プールから出題する。
 * weightedPick(n=1)だと毎回ほぼ同じ字が選ばれてしまうので、
 * 優先度の高い上位数字から1つをランダムに引く(直前と同じ字は避ける)。
 */
export const buildChallengeQ = (pool, stats = {}, direction, excludeId = null) => {
  if (pool.length < 4) return null
  const cands = weightedPick(pool, stats, Math.min(6, pool.length))
  const usable = cands.filter((c) => c.id !== excludeId)
  const list = usable.length ? usable : cands
  const target = list[Math.floor(Math.random() * list.length)]
  return makeChoiceQ(target, pool, direction)
}

export { shuffle }
