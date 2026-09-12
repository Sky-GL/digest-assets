import { levelOf, levelProgress, XP_PER_LEVEL } from '../hooks/useProgress'
import ThemePicker from './ThemePicker'

export default function HUD({ progress, onHome, onReset }) {
  const lv = levelOf(progress.xp)
  const pct = Math.round(levelProgress(progress.xp) * 100)
  return (
    <header className="hud">
      <button className="logo" onClick={onHome}>
        <span className="logo-mark">क</span>
        <span className="logo-text">Devanagari Quest</span>
      </button>
      <div className="hud-stats">
        <div className="lv-box">
          <span className="lv-label">Lv.{lv}</span>
          <div className="lv-bar">
            <div className="lv-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="lv-xp">{progress.xp % XP_PER_LEVEL}/{XP_PER_LEVEL}</span>
        </div>
        <div className="chip" title="連続学習日数">🔥 {progress.streak.count}</div>
        <div className="chip" title="累計XP">⭐ {progress.xp}</div>
        <ThemePicker />
        <button className="chip ghost" onClick={onReset} title="進捗をリセット">↺</button>
      </div>
    </header>
  )
}
