import { useCallback, useEffect, useRef, useState } from 'react'
import { PopEngine } from '../lib/popEngine'
import { POP_STAGES, popStage, shade, withAlpha } from '../data/popStages'
import { loadPop, savePop, addExp, expToNext, recordBest, markCleared } from '../lib/popStore'
import { hasHindiVoice, speakText } from '../lib/speech'
import { unlockAudio } from '../lib/sfx'
import { SPECIALS } from '../lib/popSpecials'

// DOM側の小さなメダル(進化の並び・結果表示・ステージ選択で使う)。描画はCanvas側(drawMedal)と揃える
function Bubble({ item, size = 40, active = false, dim = false }) {
  const long = [...item.glyph].length > 2
  const showLabel = size >= 36
  return (
    <span
      className={`pop-bubble ${active ? 'active' : ''} ${dim ? 'dim' : ''}`}
      style={{
        width: size,
        height: size,
        borderColor: item.base,
        background: `radial-gradient(circle at 32% 26%, ${shade(item.base, -0.35)}, ${shade(item.base, -0.68)} 60%, ${shade(item.base, -0.85)})`,
        boxShadow: `0 0 ${size * 0.25}px ${withAlpha(item.base, 0.5)}`,
      }}
    >
      <span className="pop-b-glyph" style={{ fontSize: size * (long ? 0.4 : showLabel ? 0.5 : 0.58) }}>{item.glyph}</span>
      {showLabel && (
        <span className="pop-b-label" style={{ fontSize: Math.max(9, size * 0.22), color: shade(item.base, 0.65) }}>{item.label}</span>
      )}
    </span>
  )
}

function HowTo({ onClose }) {
  return (
    <div className="pop-overlay" onClick={onClose}>
      <div className="pop-card" onClick={(e) => e.stopPropagation()}>
        <h2>あそびかた</h2>
        <ol className="pop-howto">
          <li>画面をタップ／ドラッグして位置を決め、指を離すと文字メダルが落ちます。</li>
          <li>同じ文字どうしがぶつかると合体して、次の文字に進化します。</li>
          <li>ステージの文字がまんべんなく降ってきます。落とす・合体するたびにヒンディー語で読み上げるので、音と形をセットで覚えましょう。</li>
          <li>点線より上に積み上がるとゲームオーバー。最後の文字まで進化させるとステージクリアで、完成した文字はボーナス点になって消えます。</li>
        </ol>
        <p className="pop-howto-sub">ときどき降ってくる特別メダル(積み上がるほど出やすい)</p>
        <ul className="pop-specials">
          {Object.values(SPECIALS).map((sp) => (
            <li key={sp.id}><span>{sp.icon}</span><span><strong>{sp.name}</strong> {sp.desc}</span></li>
          ))}
        </ul>
        <button className="btn primary" onClick={onClose}>わかった!</button>
      </div>
    </div>
  )
}

export default function PopGame({ onBack }) {
  const [save, setSave] = useState(loadPop)
  const saveRef = useRef(save)
  const [stageId, setStageId] = useState(1)
  const [phase, setPhase] = useState('title') // 'title' | 'play'
  const [help, setHelp] = useState(false)
  const [score, setScore] = useState(0)
  const [next, setNext] = useState({ level: 0 }) // 次に降るもの: { level } か { special }
  const [unlocked, setUnlocked] = useState(0) // このプレイで到達した最大レベル
  const [over, setOver] = useState(null) // { score }
  const [hint, setHint] = useState(true)
  const [toast, setToast] = useState(null) // { kind: 'level'|'clear', ... }

  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const toastTimer = useRef(null)
  const stage = popStage(stageId)

  const commit = useCallback((next) => {
    saveRef.current = next
    setSave(next)
    savePop(next)
  }, [])

  const showToast = useCallback((t, ms) => {
    clearTimeout(toastTimer.current)
    setToast(t)
    toastTimer.current = setTimeout(() => setToast(null), ms)
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  // プレイ画面に入ったらエンジンを起動、離れたら破棄
  useEffect(() => {
    if (phase !== 'play' || !canvasRef.current) return undefined
    const engine = new PopEngine(stage, {
      onScore: setScore,
      onNext: setNext,
      onFirstInteract: () => setHint(false),
      onUnlock: (lv) => setUnlocked((u) => Math.max(u, lv)),
      onMerge: (lv) => {
        const { next, gained } = addExp(saveRef.current, lv + 1)
        commit(next)
        if (gained > 0) showToast({ kind: 'level', level: next.level }, 2200)
      },
      onSpecial: ({ kind, count, level, points }) => {
        // 消せた数に応じて経験値も入る
        const { next: sv, gained } = addExp(saveRef.current, Math.max(3, count * 2))
        commit(sv)
        const letter = stage.chars[level]
        const text =
          kind === 'complete' ? `👑 ${letter.glyph} 完成!`
            : kind === 'crown' ? `👑 全部消えた! ${count}個`
              : `💎 ${letter.glyph} を全部消した! ${count}個`
        showToast({ kind: 'special', text, sub: `+${points}点${gained > 0 ? ` ・ Lv ${sv.level}` : ''}` }, 2200)
      },
      onStageClear: () => {
        if (!saveRef.current.cleared[stageId]) {
          commit(markCleared(saveRef.current, stageId))
          showToast({ kind: 'clear' }, 3000)
        }
      },
      onFinish: (s) => {
        commit(recordBest(saveRef.current, stageId, s))
        setOver({ score: s })
      },
    })
    engine.mount(canvasRef.current)
    engineRef.current = engine
    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [phase, stageId, stage, commit, showToast])

  const resetRound = () => {
    setScore(0)
    setUnlocked(0)
    setOver(null)
    setToast(null)
  }

  const play = () => {
    unlockAudio()
    resetRound()
    setHint(true)
    setPhase('play')
  }

  const retry = () => {
    unlockAudio()
    resetRound()
    engineRef.current?.restart()
  }

  const toTitle = () => {
    resetRound()
    setPhase('title')
  }

  const nextLevel = next.special ? -1 : next.level
  const listen = () => {
    unlockAudio()
    if (!next.special) speakText(stage.chars[next.level].speak, { rate: 0.8 })
  }

  // ---------- タイトル(ステージ選択) ----------
  if (phase === 'title') {
    return (
      <div className="screen pop">
        <div className="screen-head">
          <button className="btn ghost" onClick={onBack}>← マップ</button>
        </div>
        <div className="pop-title">
          <div className="pop-hero">
            {popStage(1).chars.slice(0, 5).map((c, i) => (
              <span key={c.glyph} style={{ animation: `pop-bounce 1.8s ease-in-out ${i * 0.12}s infinite` }}>
                <Bubble item={c} size={46 + i * 5} />
              </span>
            ))}
          </div>
          <h1>デーヴァナーガリー・ポップ</h1>
          <p className="pop-tag">MERGE · EVOLVE · MASTER DEVANAGARI</p>
          <div className="pop-pills">
            <span className="pop-pill">Lv <strong>{save.level}</strong></span>
            {save.best[stageId] > 0 && <span className="pop-pill">👑 <strong>{save.best[stageId]}</strong></span>}
          </div>

          <div className="pop-stages">
            {POP_STAGES.map((s) => (
              <button
                key={s.id}
                className={`pop-stage ${s.id === stageId ? 'sel' : ''}`}
                onClick={() => setStageId(s.id)}
              >
                <Bubble item={s.chars[0]} size={44} />
                <span className="pop-stage-no">STAGE {s.id}{save.cleared[s.id] ? ' ★' : ''}</span>
                <strong>{s.title}</strong>
                <span className="pop-stage-sub">{s.subtitle}</span>
              </button>
            ))}
          </div>

          <button className="btn primary big pulse" onClick={play}>▶ PLAY</button>
          <button className="btn ghost" onClick={() => setHelp(true)}>❓ あそびかた</button>
          {!hasHindiVoice() && (
            <p className="pop-note">
              この端末にはヒンディー語(hi-IN)の音声が無いため、読み上げは鳴りません。ゲームは遊べます。
            </p>
          )}
        </div>
        {help && <HowTo onClose={() => setHelp(false)} />}
      </div>
    )
  }

  // ---------- プレイ ----------
  const cur = next.special ? null : stage.chars[Math.min(next.level, stage.chars.length - 1)]
  const spDef = next.special ? SPECIALS[next.special] : null
  const need = expToNext(save.level)

  return (
    <div className="screen pop">
      <div className="pop-top">
        <button className="btn ghost sm" onClick={toTitle}>← ステージ選択</button>
        <button className="btn ghost sm" onClick={() => setHelp(true)} aria-label="あそびかた">❓</button>
      </div>

      <div className="pop-chain">
        {stage.chars.map((c, i) => (
          <span key={c.glyph} className="pop-chain-item">
            <Bubble item={c} size={42} active={i === nextLevel} dim={i > unlocked} />
            {i < stage.chars.length - 1 && <span className="pop-arrow">▸</span>}
          </span>
        ))}
      </div>

      <div className="pop-bar">
        <span className="pop-pill sm">Lv <strong>{save.level}</strong></span>
        <div className="pop-exp"><div style={{ width: `${Math.min(100, (save.exp / need) * 100)}%` }} /></div>
        <span className="pop-pill sm">⭐ <strong>{score}</strong></span>
        <span className="pop-pill sm">👑 <strong>{Math.max(save.best[stageId] || 0, 0)}</strong></span>
      </div>

      <div className="pop-field">
        <canvas ref={canvasRef} className="pop-canvas" />
        {hint && !over && <div className="pop-hand">👆</div>}

        {toast?.kind === 'level' && (
          <div className="pop-toast">
            ✨ Lv {toast.level} ✨
          </div>
        )}
        {toast?.kind === 'special' && (
          <div className="pop-toast">{toast.text}<small>{toast.sub}</small></div>
        )}
        {toast?.kind === 'clear' && (
          <div className="pop-toast">🎉 STAGE {stageId} クリア!<small>最後の文字まで進化しました</small></div>
        )}

        {over && (
          <div className="pop-overlay in-field">
            <div className="pop-card">
              <h2>Finish! 🎉</h2>
              <div className="pop-score">
                <span>SCORE</span>
                <strong>{over.score}</strong>
                <small>BEST {Math.max(save.best[stageId] || 0, over.score)}</small>
              </div>
              <p className="pop-learned">今回出会った文字</p>
              <div className="pop-learned-row">
                {stage.chars.slice(0, unlocked + 1).map((c) => (
                  <Bubble key={c.glyph} item={c} size={44} />
                ))}
              </div>
              <div className="cta-row">
                <button className="btn" onClick={toTitle}>🏠 ステージ選択</button>
                <button className="btn primary" onClick={retry}>↻ もう一回</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pop-listen">
        {spDef ? (
          <div className="pop-special-note">
            <span className="pop-special-icon">{spDef.icon}</span>
            <span><strong>{spDef.name}</strong> {spDef.desc}</span>
          </div>
        ) : (
          <button className="btn" onClick={listen}>
            🔊 <span className="pop-listen-glyph">{cur.glyph}</span> <small>{cur.label}</small>
          </button>
        )}
      </div>
      {help && <HowTo onClose={() => setHelp(false)} />}
    </div>
  )
}
