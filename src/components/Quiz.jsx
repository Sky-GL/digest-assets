import { useEffect, useState } from 'react'
import { stepMeta, charById } from '../data/steps'
import SpeakButton from './SpeakButton'
import GlyphDiff from './GlyphDiff'

export default function Quiz({ title, accent = '#fbbf24', questions, onAnswer, onFinish, onBack, onRetry }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [done, setDone] = useState(false)
  const [wrongIds, setWrongIds] = useState([])
  const [result, setResult] = useState(null)

  const q = questions[i]
  const total = questions.length

  // 集計は描画中ではなく完了後に1回だけ実行する
  useEffect(() => {
    if (done) setResult(onFinish(score, total, maxCombo))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  const choose = (optId) => {
    if (picked) return
    const ok = optId === q.answerId
    setPicked(optId)
    onAnswer(q.charId, ok)
    if (ok) {
      setScore((s) => s + 1)
      setCombo((c) => {
        const n = c + 1
        setMaxCombo((m) => Math.max(m, n))
        return n
      })
    } else {
      setCombo(0)
      setWrongIds((w) => [...w, q.charId])
    }
  }

  const next = () => {
    setPicked(null)
    if (i + 1 >= total) setDone(true)
    else setI(i + 1)
  }

  if (done) {
    const rate = Math.round((score / total) * 100)
    return (
      <div className="screen result" style={{ '--accent': accent }}>
        <div className={`result-badge ${result?.cleared ? 'ok' : 'ng'}`}>
          {result?.cleared ? '🎉 CLEAR!' : '💪 もう一息'}
        </div>
        <div className="result-stars">
          {[0, 1, 2].map((n) => (
            <span key={n} className={n < (result?.stars || 0) ? 'star on big' : 'star big'}>★</span>
          ))}
        </div>
        <h2>{score} / {total} 正解({rate}%)</h2>
        <div className="result-stats">
          <div><span>最大コンボ</span><strong>{maxCombo}</strong></div>
          <div><span>獲得XP</span><strong>+{score * 10 + (total - score) * 2 + (result?.cleared ? 50 : 0)}</strong></div>
        </div>
        {!result?.cleared && <p className="hint-text">正答率80%以上で次のStepが開放されます。</p>}
        {wrongIds.length > 0 && (
          <p className="hint-text">間違えた文字は復習モードで優先的に出題されます。</p>
        )}
        <div className="cta-row">
          <button className="btn" onClick={onBack}>マップへ戻る</button>
          <button className="btn primary" onClick={onRetry}>もう一度</button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen quiz" style={{ '--accent': accent }}>
      <div className="quiz-head">
        <button className="btn ghost sm" onClick={onBack}>✕</button>
        <div className="quiz-bar">
          <div className="quiz-fill" style={{ width: `${(i / total) * 100}%` }} />
        </div>
        <span className="quiz-count">{i + 1}/{total}</span>
      </div>
      {combo >= 3 && <div className="combo">🔥 {combo} COMBO!</div>}

      <h3 className="quiz-title">{title}</h3>
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

      {picked && (
        <div className={`feedback ${picked === q.answerId ? 'ok' : 'ng'}`}>
          <strong>{picked === q.answerId ? '正解!' : '惜しい!'}</strong>
          {q.explain && <p>{q.explain}</p>}
          {/* 誤答時は「選んだ字」と「正解」を重ねて、どこで間違えたかを見せる */}
          {picked !== q.answerId && charById(picked) && charById(q.answerId) && (
            <div className="feedback-diff">
              <p className="fd-title">選んだ字と正解を重ねると…</p>
              <GlyphDiff a={charById(picked)} b={charById(q.answerId)} size={66} compact />
            </div>
          )}
          <button className="btn primary" onClick={next} autoFocus>
            {i + 1 >= total ? '結果を見る' : '次へ →'}
          </button>
        </div>
      )}
    </div>
  )
}

export const quizAccent = (step) => stepMeta(step)?.color || '#fbbf24'
