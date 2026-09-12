import { STEPS, charsOfStep } from '../data/steps'

const Stars = ({ n }) => (
  <span className="stars">
    {[0, 1, 2].map((i) => (
      <span key={i} className={i < n ? 'star on' : 'star'}>★</span>
    ))}
  </span>
)

export default function StepMap({ progress, onSelect, onReview, onWords, onMemory, onChallenge }) {
  const learnedCount = Object.values(progress.chars).length
  const weakCount = Object.values(progress.chars).filter((c) => c.wrong > 0).length

  return (
    <div className="stepmap">
      <div className="map-header">
        <h1>学習マップ</h1>
        <p>母音の基本形→子音の代表音(「かさたなはまやらわ」相当)を先に一巡→各行を深掘り、の順がおすすめですが、どのStepからでも自由に始められます。Stepクイズで80%以上正解すると★が付きます。</p>
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

      <div className="mode-row">
        <button className="mode-card words" onClick={onWords}>
          <span className="mode-emoji">📖</span>
          <strong>単語モード</strong>
          <span className="mode-sub">覚えた文字で実際の単語を読む。59語収録</span>
        </button>
        <button className="mode-card challenge" onClick={onChallenge}>
          <span className="mode-emoji">⚡</span>
          <strong>4択チャレンジ</strong>
          <span className="mode-sub">
            ライフ3で何問続く? {progress.bestChallenge ? `ベスト ${progress.bestChallenge} 点` : 'まずは1回'}
          </span>
        </button>
        <button className="mode-card memory" onClick={onMemory}>
          <span className="mode-emoji">🃏</span>
          <strong>神経衰弱</strong>
          <span className="mode-sub">ペア探し。3〜6ペアで難易度を選べます</span>
        </button>
      </div>

      <div className="steps">
        {STEPS.map((s) => {
          const st = progress.steps[s.step]
          const chars = charsOfStep(s.step)
          return (
            <button
              key={s.step}
              className={`step-card ${st?.cleared ? 'cleared' : ''}`}
              style={{ '--accent': s.color }}
              onClick={() => onSelect(s.step)}
            >
              <div className="step-top">
                <span className="step-emoji">{s.emoji}</span>
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
