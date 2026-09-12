import { useEffect, useRef, useState } from 'react'
import { ALL_CHARS, charById } from '../data/steps'
import { buildChallengeQ } from '../lib/quiz'
import { playCorrect, playWrong, playClear } from '../lib/sfx'
import SpeakButton from './SpeakButton'
import GlyphDiff from './GlyphDiff'

const LIVES = 3

/** 出題プール: 学習済みを優先し、少なすぎるときは頻出(core)で補う */
const buildPool = (learnedIds) => {
  const learned = ALL_CHARS.filter((c) => learnedIds.has(c.id))
  if (learned.length >= 6) return learned
  const core = ALL_CHARS.filter((c) => c.freq === 'core' && !learnedIds.has(c.id))
  return [...learned, ...core].slice(0, 10)
}

export default function Challenge({ learnedIds, onBack, onAnswer, best, onRecord }) {
  // プールはマウント時に確定させる(解答のたびに学習記録が変わり、途中で出題範囲が動くのを防ぐ)
  const [pool] = useState(() => buildPool(learnedIds))
  const [q, setQ] = useState(() => buildChallengeQ(pool, {}, 'char2read'))
  const [picked, setPicked] = useState(null)
  const [lives, setLives] = useState(LIVES)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [over, setOver] = useState(false)
  // 判定用に「今回の挑戦を始めた時点のベスト」を保持する(onRecord後のbestと比べると常に更新扱いになるため)
  const [bestBefore, setBestBefore] = useState(best)
  const nRef = useRef(0)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!over) return
    playClear()
    onRecord(score)
  }, [over])

  const nextQ = () => {
    nRef.current += 1
    setPicked(null)
    setQ((prev) => buildChallengeQ(pool, {}, nRef.current % 2 ? 'read2char' : 'char2read', prev?.charId))
  }

  const choose = (optId) => {
    if (picked) return
    const ok = optId === q.answerId
    setPicked(optId)
    onAnswer(q.charId, ok)

    if (ok) {
      playCorrect()
      const c = combo + 1
      setCombo(c)
      setBestCombo((b) => Math.max(b, c))
      setScore((s) => s + 1 + Math.floor(c / 3)) // 3連続ごとに1問あたりの得点が増える
      timer.current = setTimeout(nextQ, 600) // 正解はテンポよく自動で次へ
    } else {
      playWrong()
      setCombo(0)
      setLives((l) => l - 1)
    }
  }

  const afterWrong = () => {
    if (lives <= 0) setOver(true)
    else nextQ()
  }

  const restart = () => {
    clearTimeout(timer.current)
    setBestBefore((b) => Math.max(b, score))
    nRef.current = 0
    setPicked(null)
    setLives(LIVES)
    setScore(0)
    setCombo(0)
    setBestCombo(0)
    setOver(false)
    setQ(buildChallengeQ(pool, {}, 'char2read'))
  }

  if (!q) {
    return (
      <div className="screen">
        <div className="screen-head">
          <button className="btn ghost" onClick={onBack}>← マップ</button>
        </div>
        <p className="hint-text">出題できる文字が足りません。まずStep1のフラッシュカードから始めてください。</p>
      </div>
    )
  }

  if (over) {
    const isBest = score > bestBefore
    return (
      <div className="screen result" style={{ '--accent': 'var(--accent-base)' }}>
        <div className={`result-badge ${isBest ? 'ok' : ''}`}>{isBest ? '🏆 自己ベスト更新!' : '⚡ ゲームオーバー'}</div>
        <h2>{score} 点</h2>
        <p className="hint-text">最大コンボ {bestCombo} / ベスト {Math.max(bestBefore, score)} 点</p>
        <div className="cta-row">
          <button className="btn" onClick={onBack}>マップへ戻る</button>
          <button className="btn primary" onClick={restart}>もう一回</button>
        </div>
      </div>
    )
  }

  const wrong = picked && picked !== q.answerId

  return (
    <div className="screen quiz challenge" style={{ '--accent': 'var(--accent-base)' }}>
      <div className="screen-head">
        <button className="btn ghost" onClick={onBack}>← マップ</button>
        <div className="head-title">
          <span className="step-emoji">⚡</span>
          <div>
            <h2>4択チャレンジ</h2>
            <p>ライフ3。間違えなければ何問でも続きます。連続正解で1問の得点が上がります。</p>
          </div>
        </div>
      </div>

      <div className="ch-stats">
        <span className="ch-lives">
          {'❤️'.repeat(Math.max(lives, 0))}
          {'🖤'.repeat(Math.max(LIVES - lives, 0))}
        </span>
        <span>スコア <strong>{score}</strong></span>
        <span>ベスト <strong>{best}</strong></span>
      </div>

      {combo >= 3 && <div className="combo">🔥 {combo} COMBO!</div>}

      <p className="quiz-sub">{q.promptSub}</p>
      <div className="quiz-prompt">
        <span className={q.kind === 'read2char' ? 'prompt-text' : 'prompt-glyph'}>{q.prompt}</span>
        {q.promptKana && <span className="prompt-kana">{q.promptKana}</span>}
        {(q.speakChar || q.speakText) && <SpeakButton char={q.speakChar} text={q.speakText} size="sm" />}
      </div>

      <div className={`options ${q.options[0]?.big || q.kind === 'read2char' ? 'glyph-options' : ''}`}>
        {q.options.map((o) => {
          const state = !picked ? '' : o.id === q.answerId ? 'correct' : o.id === picked ? 'wrong' : 'dim'
          return (
            <button key={o.id} className={`option ${state}`} onClick={() => choose(o.id)} disabled={!!picked}>
              {o.text}
            </button>
          )
        })}
      </div>

      {wrong && (
        <div className="feedback ng">
          <strong>惜しい! 残りライフ {Math.max(lives, 0)}</strong>
          {q.explain && <p>{q.explain}</p>}
          {charById(picked) && charById(q.answerId) && (
            <div className="feedback-diff">
              <p className="fd-title">選んだ字と正解を重ねると…</p>
              <GlyphDiff a={charById(picked)} b={charById(q.answerId)} size={66} compact />
            </div>
          )}
          <button className="btn primary" onClick={afterWrong} autoFocus>
            {lives <= 0 ? '結果を見る' : '次の問題 →'}
          </button>
        </div>
      )}
    </div>
  )
}
