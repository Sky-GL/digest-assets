// データ整合性テスト。カリキュラム・ペア・単語・ポップのデータが壊れたら CI で落とす。
// 実行: npm test (vitest)
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { STEPS, ALL_CHARS, charById, charsOfStep, MATRA_BASE_IDS, MATRA_STEP } from '../src/data/steps.js'
import { PAIRS } from '../src/data/pairs.js'
import { ALL_WORDS } from '../src/data/words.js'
import { POP_STAGES } from '../src/data/popStages.js'
import { buildStepQuiz, buildReviewQuiz } from '../src/lib/quiz.js'

test('文字IDが一意で必須項目を持つ', () => {
  const ids = ALL_CHARS.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length, 'id が重複している')
  for (const c of ALL_CHARS) {
    for (const k of ['devanagari', 'iast', 'kana', 'group', 'step', 'freq']) {
      assert.ok(c[k] !== undefined && c[k] !== '', `${c.id}: ${k} が空`)
    }
    assert.ok(['core', 'common', 'rare'].includes(c.freq), `${c.id}: freq が不正 (${c.freq})`)
  }
})

test('全Stepに文字があり、文字のstepはSTEPSに存在する', () => {
  const steps = new Set(STEPS.map((s) => s.step))
  for (const c of ALL_CHARS) assert.ok(steps.has(c.step), `${c.id}: 未定義の step ${c.step}`)
  for (const s of STEPS) assert.ok(charsOfStep(s.step).length > 0, `Step${s.step} に文字が無い`)
})

test('マートラ練習用の子音IDが存在する', () => {
  for (const id of MATRA_BASE_IDS) assert.ok(charById(id), `MATRA_BASE_IDS: ${id} が無い`)
  assert.ok(charsOfStep(MATRA_STEP).length > 0)
})

test('見比べペアの参照先が存在し、a→b の向きで先に習う側がaになっている', () => {
  const kinds = new Set(['length', 'matra', 'derived', 'lookalike'])
  for (const p of PAIRS) {
    const a = charById(p.a)
    const b = charById(p.b)
    assert.ok(a, `PAIRS: ${p.a} が無い`)
    assert.ok(b, `PAIRS: ${p.b} が無い`)
    assert.ok(kinds.has(p.kind), `PAIRS ${p.a}-${p.b}: kind が不正 (${p.kind})`)
    assert.ok(p.note, `PAIRS ${p.a}-${p.b}: note が空`)
  }
})

test('単語の構成文字IDがすべて存在し、単語IDが一意', () => {
  const ids = ALL_WORDS.map((w) => w.id)
  assert.equal(new Set(ids).size, ids.length, '単語 id が重複している')
  for (const w of ALL_WORDS) {
    for (const cid of w.chars) assert.ok(charById(cid), `単語 ${w.id}: 文字 ${cid} が無い`)
    assert.ok([1, 2].includes(w.level), `単語 ${w.id}: level が不正`)
  }
})

test('ポップの全ステージは5文字で、読みと半径が妥当', () => {
  assert.equal(POP_STAGES.length, 12)
  for (const s of POP_STAGES) {
    assert.equal(s.chars.length, 5, `${s.title}: 5文字ではない(クリアに最終形16個が必要なため5固定)`)
    for (const c of s.chars) {
      assert.ok(c.glyph && c.label, `${s.title}: glyph/label が空`)
      assert.ok(c.radius >= 30 && c.radius <= 56, `${s.title}: radius が範囲外`)
    }
    const radii = s.chars.map((c) => c.radius)
    assert.deepEqual([...radii].sort((x, y) => x - y), radii, `${s.title}: 半径が昇順でない`)
  }
})

test('クイズ生成が全Stepで例外なく選択肢に正解を含む', () => {
  for (const s of STEPS) {
    const qs = buildStepQuiz(s.step, {})
    assert.ok(qs.length > 0, `Step${s.step}: 問題が0件`)
    for (const q of qs) {
      assert.ok(q.options?.length >= 2, `Step${s.step}: 選択肢が足りない`)
      assert.equal(new Set(q.options.map((o) => o.id ?? o.label ?? o)).size, q.options.length, `Step${s.step}: 選択肢が重複`)
    }
  }
  assert.ok(buildReviewQuiz({}) !== undefined)
})
