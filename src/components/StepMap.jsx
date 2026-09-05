import { STEPS, charsOfStep } from '../data/steps'

const Stars = ({ n }) => (
  <span className="stars">
    {[0, 1, 2].map((i) => (
      <span key={i} className={i < n ? 'star on' : 'star'}>★</span>
    ))}
  </span>
)

export default function StepMap({ progress, onSelect, onReview }) {
  const learnedCount = Object.values(progress.chars).length
  const weakCount = Object.values(progress.chars).filter((c) => c.wrong > 0).length

  return (
    <div className="stepmap">
      <div className="map-header">
        <h1>学習マップ</h1>
        <p>母音 → 子音(喉の奥から唇へ)の順に進みます。Stepクイズで80%以上正解すると次が開放。</p>
      </div>

      <div className="review-banner">
        <div>
          <strong>復習モード</strong>
          <span className="sub">
            学習済み {learnedCount} 文字 / 苦手 {weakCount} 文字 — 間違えた文字を優先出題
          </span>
        </div>
        <button className="btn primary" disabled={learnedCount === 0} onClick={onReview}>
          {learnedCount === 0 ? 'Step1から始めよう' : '苦手を復習する'}
        </button>
      </div>

      <div className="steps">
        {STEPS.map((s) => {
          const unlocked = s.step <= progress.unlockedStep
          const st = progress.steps[s.step]
          const chars = charsOfStep(s.step)
          return (
            <button
              key={s.step}
              className={`step-card ${unlocked ? '' : 'locked'} ${st?.cleared ? 'cleared' : ''}`}
              style={{ '--accent': s.color }}
              disabled={!unlocked}
              onClick={() => onSelect(s.step)}
            >
              <div className="step-top">
                <span className="step-emoji">{unlocked ? s.emoji : '🔒'}</span>
                <span className="step-no">STEP {s.step}</span>
                {st?.cleared && <Stars n={st.stars} />}
              </div>
              <h3>{s.title}</h3>
              <p className="step-sub">{s.subtitle}</p>
              <div className="step-chars">
                {chars.slice(0, 6).map((c) => (
                  <span key={c.id}>{c.display || c.devanagari}</span>
                ))}
                {chars.length > 6 && <span className="more">+{chars.length - 6}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
