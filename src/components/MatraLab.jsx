import { useState } from 'react'
import { charsOfStep, charById, MATRA_BASE_IDS, MATRA_STEP, syllable } from '../data/steps'
import { speakText } from '../lib/speech'
import SpeakButton from './SpeakButton'

// マートラStep専用: 子音 × マートラ を自由に組み合わせて読みを確認する実験室
export default function MatraLab({ onBack, onQuiz }) {
  const matras = charsOfStep(MATRA_STEP)
  const bases = MATRA_BASE_IDS.map(charById)
  const [baseId, setBaseId] = useState('ka')
  const [matraId, setMatraId] = useState('m_aa')

  const base = charById(baseId)
  const matra = matras.find((m) => m.id === matraId)
  const { devanagari: combined, iast: reading, kana: readingKana } = syllable(base, matra)
  const consonant = base.iast.replace(/a$/, '')

  const pick = (setter, val, text) => {
    setter(val)
    if (text) speakText(text)
  }

  return (
    <div className="screen matralab" style={{ '--accent': '#fbbf24' }}>
      <div className="screen-head">
        <button className="btn ghost" onClick={onBack}>← 戻る</button>
        <div className="head-title">
          <span className="step-emoji">🧪</span>
          <div>
            <h2>マートラ実験室</h2>
            <p>子音とマートラを組み合わせると音節ができる。単語が読める第一歩。</p>
          </div>
        </div>
      </div>

      <div className="lab-formula">
        <div className="lab-slot">
          <span className="slot-label">子音</span>
          <span className="slot-glyph">{base.devanagari}</span>
          <span className="slot-read">{consonant}</span>
          <span className="slot-kana">{base.kana}</span>
        </div>
        <span className="lab-op">+</span>
        <div className="lab-slot">
          <span className="slot-label">マートラ</span>
          <span className="slot-glyph">{matra.display || matra.devanagari}</span>
          <span className="slot-read">{matra.iast}</span>
        </div>
        <span className="lab-op">=</span>
        <div className="lab-slot result">
          <span className="slot-label">音節</span>
          <span className="slot-glyph big">{combined}</span>
          <span className="slot-read">{reading} {matra.ipa}</span>
          {readingKana && <span className="slot-kana big">{readingKana}</span>}
        </div>
        <SpeakButton text={combined} label="音節を聞く" />
      </div>

      <p className="lab-note">
        <strong>{matra.position}に付く</strong> — {matra.note}
      </p>

      <div className="lab-section">
        <h4>子音を選ぶ</h4>
        <div className="chip-grid">
          {bases.map((b) => (
            <button
              key={b.id}
              className={`glyph-chip ${b.id === baseId ? 'on' : ''}`}
              onClick={() => pick(setBaseId, b.id, b.devanagari + matra.devanagari)}
            >
              <span>{b.devanagari}</span>
              <em>{b.iast} / {b.kana}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="lab-section">
        <h4>マートラを選ぶ</h4>
        <div className="chip-grid">
          {matras.map((m) => (
            <button
              key={m.id}
              className={`glyph-chip ${m.id === matraId ? 'on' : ''}`}
              onClick={() => pick(setMatraId, m.id, base.devanagari + m.devanagari)}
            >
              <span>{m.display || m.devanagari}</span>
              <em>{m.iast}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="lab-section">
        <h4>{base.devanagari} の全12音節</h4>
        <div className="syllable-grid">
          <button className="syllable" onClick={() => speakText(base.devanagari)}>
            <span>{base.devanagari}</span><em>{base.iast}</em>{base.kana && <small>{base.kana}</small>}
          </button>
          {matras.map((m) => {
            const s = syllable(base, m)
            return (
              <button key={m.id} className="syllable" onClick={() => speakText(s.devanagari)}>
                <span>{s.devanagari}</span>
                <em>{s.iast}</em>
                {s.kana && <small>{s.kana}</small>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="cta-row">
        <button className="btn primary big" onClick={onQuiz}>組み合わせクイズに挑戦</button>
      </div>
    </div>
  )
}
