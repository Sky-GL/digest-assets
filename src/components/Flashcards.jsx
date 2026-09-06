import { useEffect, useState } from 'react'
import { charsOfStep, stepMeta } from '../data/steps'
import { pairsOf } from '../data/pairs'
import SpeakButton from './SpeakButton'
import GlyphDiff from './GlyphDiff'
import { speak } from '../lib/speech'

const PAIR_TITLE = {
  length: '短音と長音を重ねて見る',
  matra: '長短マートラを重ねて見る',
  lookalike: 'そっくりな字と重ねて見る',
}

export default function Flashcards({ step, onQuiz, onBack, onMatraLab }) {
  const meta = stepMeta(step)
  const chars = charsOfStep(step)
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [seen, setSeen] = useState(() => new Set([0]))
  const [pairIdx, setPairIdx] = useState(0)
  const c = chars[idx]
  const pairs = pairsOf(c.id)
  const pair = pairs[Math.min(pairIdx, pairs.length - 1)]

  // カード切替時に自動で発音(学習効率が上がる)
  useEffect(() => {
    speak(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  const go = (d) => {
    const next = Math.min(Math.max(idx + d, 0), chars.length - 1)
    setIdx(next)
    setFlipped(false)
    setPairIdx(0)
    setSeen((s) => new Set(s).add(next))
  }

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const allSeen = seen.size >= chars.length

  return (
    <div className="screen" style={{ '--accent': meta.color }}>
      <div className="screen-head">
        <button className="btn ghost" onClick={onBack}>← マップ</button>
        <div className="head-title">
          <span className="step-emoji">{meta.emoji}</span>
          <div>
            <h2>STEP {step} {meta.title}</h2>
            <p>{meta.tip}</p>
          </div>
        </div>
      </div>

      <div className="progress-dots">
        {chars.map((ch, i) => (
          <button
            key={ch.id}
            className={`dot ${i === idx ? 'active' : ''} ${seen.has(i) ? 'seen' : ''}`}
            onClick={() => { setIdx(i); setFlipped(false); setPairIdx(0); setSeen((s) => new Set(s).add(i)) }}
          >
            {ch.display || ch.devanagari}
          </button>
        ))}
      </div>

      <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
        <div className="fc-inner">
          <div className="fc-face fc-front">
            {c.rare && <span className="badge rare">稀に使用</span>}
            {c.series && <span className="badge series">{c.series}</span>}
            <div className="glyph">{c.display || c.devanagari}</div>
            <div className="glyph-kana">{c.kana}</div>
            <div className="fc-hint">タップで詳しい読みを表示</div>
            <SpeakButton char={c} />
          </div>
          <div className="fc-face fc-back">
            <div className="glyph small">{c.display || c.devanagari}</div>
            <div className="readings">
              <div className="read-row"><span className="rl">IAST</span><span className="rv">{c.iast}</span></div>
              <div className="read-row"><span className="rl">IPA</span><span className="rv">{c.ipa}</span></div>
              <div className="read-row"><span className="rl">カナ</span><span className="rv">{c.kana}</span></div>
              {c.example && <div className="read-row"><span className="rl">例</span><span className="rv">{c.example} = {c.exampleRead}</span></div>}
              {c.parts && <div className="read-row"><span className="rl">構成</span><span className="rv">{c.parts}</span></div>}
            </div>
            <p className="note">{c.note}</p>
            <SpeakButton char={c} />
          </div>
        </div>
      </div>

      <div className="fc-nav">
        <button className="btn" onClick={() => go(-1)} disabled={idx === 0}>← 前</button>
        <span className="counter">{idx + 1} / {chars.length}</span>
        <button className="btn" onClick={() => go(1)} disabled={idx === chars.length - 1}>次 →</button>
      </div>

      {pair && (
        <div className="compare-box">
          <div className="compare-head">
            <h4>🔍 {PAIR_TITLE[pair.kind]}</h4>
            {pairs.length > 1 && (
              <div className="compare-tabs">
                {pairs.map((p, i) => (
                  <button
                    key={p.id}
                    className={`compare-tab ${i === pairIdx ? 'on' : ''}`}
                    onClick={() => setPairIdx(i)}
                  >
                    {p.charA.devanagari}／{p.charB.devanagari}
                  </button>
                ))}
              </div>
            )}
          </div>
          <GlyphDiff a={pair.charA} b={pair.charB} />
          <p className="compare-note">{pair.note}</p>
        </div>
      )}

      <div className="cta-row">
        {step === 12 && (
          <button className="btn secondary" onClick={onMatraLab}>🧪 マートラ組み立て練習</button>
        )}
        <button className={`btn primary big ${allSeen ? 'pulse' : ''}`} onClick={onQuiz}>
          クイズに挑戦 {allSeen ? '🔥' : ''}
        </button>
      </div>
      <p className="keyhint">← → でカード送り / スペースで裏返し</p>
    </div>
  )
}
