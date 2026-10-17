import { useCallback, useEffect, useRef, useState } from 'react'
import { PopEngine } from '../lib/popEngine'
import { POP_STAGES, popStage, shade, withAlpha } from '../data/popStages'
import { loadPop, savePop, addExp, expToNext, recordBest, markCleared, recordKey } from '../lib/popStore'
import { hasHindiVoice, speakText } from '../lib/speech'
import { unlockAudio } from '../lib/sfx'
import { FINAL_TIERS, FINALS_TO_CLEAR } from '../lib/popFinal'

// DOM側の小さなメダル(進化の並び・結果表示・ステージ選択で使う)。描画はCanvas側(drawMedal)と揃える
function Bubble({ item, size = 40, active = false, dim = false, hideLabel = false }) {
  const long = [...item.glyph].length > 2
  const showLabel = size >= 36 && !hideLabel
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

function HowTo({ mode, onClose }) {
  return (
    <div className="pop-overlay" onClick={onClose}>
      <div className="pop-card" onClick={(e) => e.stopPropagation()}>
        <h2>あそびかた</h2>
        <ol className="pop-howto">
          <li>画面をタップ／ドラッグして位置を決め、指を離すと文字メダルが落ちます。</li>
          {mode === 'read' ? (
            <>
              <li>メダルには<b>文字面</b>(क)と<b>読み面</b>(ka)があります。<b>同じ文字の「文字面 + 読み面」</b>がぶつかると合体して、次の文字に進化します。</li>
              <li>色も大きさも全部同じです。<b>文字を読んで</b>、対応する相手の隣に落としましょう。同じ面どうしは合体しません。</li>
              <li>落とす・合体するたびにヒンディー語で読み上げるので、合っていたか耳でも確認できます。</li>
            </>
          ) : (
            <>
              <li>同じ文字どうしがぶつかると合体して、次の文字に進化します。</li>
              <li>ステージの5文字がまんべんなく降ってきます。落とす・合体するたびにヒンディー語で読み上げるので、音と形をセットで覚えましょう。</li>
            </>
          )}
          <li>点線より上に積み上がるとゲームオーバーです。</li>
        </ol>
        <p className="pop-howto-sub">ステージクリアのルール(最終形を育てる)</p>
        <ul className="pop-final-rules">
          <li><span>最終形 + 最終形</span><b>→ 👑 最終形(バッジ2)</b></li>
          <li><span>👑 + 👑</span><b>→ 💎 最終形(バッジ4)</b></li>
          <li><span>💎 + 💎</span><b>→ 🌈 最終形(バッジ8)</b></li>
          <li><span>🌈 + 🌈</span><b>→ 次のステージへ!</b></li>
        </ul>
        <p className="pop-howto-note">
          同じバッジどうしだけが合体します{mode === 'read' ? '(読みモードでも、完成した最終形は文字面・読み面を問いません。同じバッジの最終形は引き寄せ合います)' : ''}。最終形は近づくと吸い付き、自動では消えません。🌈ができると虹ボーナス+300点。
          クリアには最終形が{FINALS_TO_CLEAR}個必要です。
        </p>
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
  const [next, setNext] = useState({ level: 0, face: 0 }) // 次に降るメダル
  const [tier, setTier] = useState(0) // このステージで最終形が育った最高の段階(0=最終形/1=👑/2=💎/3=🌈)
  const [unlocked, setUnlocked] = useState(0) // このプレイで到達した最大レベル
  const [over, setOver] = useState(null) // { score, grand }
  const [hint, setHint] = useState(true)
  const [toast, setToast] = useState(null) // { kind: 'level'|'clear', ... }

  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const toastTimer = useRef(null)
  const advanceTimer = useRef(null)
  const stage = popStage(stageId)
  const mode = save.mode
  const nextLevel = next.level

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

  useEffect(() => () => {
    clearTimeout(toastTimer.current)
    clearTimeout(advanceTimer.current)
  }, [])

  // プレイ画面に入ったらエンジンを起動、離れたら破棄
  useEffect(() => {
    if (phase !== 'play' || !canvasRef.current) return undefined
    const gameMode = saveRef.current.mode
    const key = recordKey(gameMode, stageId)
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
      // 最終形が 👑/💎/🌈 に進化した
      onTier: (t, points) => {
        setTier((cur) => Math.max(cur, t))
        const info = FINAL_TIERS[t]
        const final = stage.chars[stage.chars.length - 1]
        showToast(
          {
            kind: 'tier',
            text: `${info.icon} ${final.glyph} ×${info.badge}`,
            sub: t === 3 ? `🌈 RAINBOW BONUS +300 (+${points}点)` : `+${points}点`,
          },
          2200,
        )
      },
      // 🌈+🌈 が合体してステージクリア。次のステージがあれば自動で進む
      onStageClear: () => {
        commit(markCleared(saveRef.current, key))
        if (stageId < POP_STAGES.length) {
          const nextStage = popStage(stageId + 1)
          showToast({ kind: 'clear', text: `🎉 STAGE ${stageId} クリア!`, sub: `次は STAGE ${stageId + 1}「${nextStage.title}」` }, 1800)
          advanceTimer.current = setTimeout(() => {
            resetRound()
            setStageId(stageId + 1)
          }, 1500)
        } else {
          showToast({ kind: 'clear', text: '🏆 全ステージ制覇!', sub: 'おめでとうございます' }, 2500)
          advanceTimer.current = setTimeout(() => engine.finish(true), 1200)
        }
      },
      onFinish: (s, grand) => {
        commit(recordBest(saveRef.current, key, s))
        setOver({ score: s, grand: !!grand })
      },
    }, gameMode)
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
    setTier(0)
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
    clearTimeout(advanceTimer.current)
    resetRound()
    setPhase('title')
  }

  const listen = () => {
    unlockAudio()
    speakText(stage.chars[nextLevel].speak, { rate: 0.8 })
  }

  // ---------- タイトル(ステージ選択) ----------
  // スマホで一画面に収まるよう、PLAYはモード選択の直下(ステージ一覧より上)に置く。
  if (phase === 'title') {
    const bestHere = save.best[recordKey(mode, stageId)] || 0
    return (
      <div className="screen pop">
        <div className="pop-topbar">
          <button className="btn ghost sm" onClick={onBack}>← マップ</button>
          <div className="pop-topbar-right">
            <span className="pop-pill sm">Lv <strong>{save.level}</strong></span>
            {bestHere > 0 && <span className="pop-pill sm">👑 <strong>{bestHere}</strong></span>}
            <button className="btn ghost sm" onClick={() => setHelp(true)} aria-label="あそびかた">❓</button>
          </div>
        </div>
        <div className="pop-title">
          <h1>デーヴァナーガリー・ポップ</h1>

          <div className="pop-modes">
            <button className={`pop-mode ${mode === 'read' ? 'sel' : ''}`} onClick={() => commit({ ...saveRef.current, mode: 'read' })}>
              <strong>📖 読みモード</strong>
              <span>文字 <b>क</b> と読み <b>ka</b> のペアで合体。文字を読まないと進めません</span>
            </button>
            <button className={`pop-mode ${mode === 'normal' ? 'sel' : ''}`} onClick={() => commit({ ...saveRef.current, mode: 'normal' })}>
              <strong>🫧 ふつう</strong>
              <span>同じ文字どうしが合体(元のかなポップと同じ)</span>
            </button>
          </div>

          <button className="btn primary big pulse pop-play" onClick={play}>
            <span className="pop-play-main">▶ PLAY</span>
            <span className="pop-play-sub">
              STAGE {stageId} {stage.title}
              <span className="pop-play-glyphs">{stage.chars.map((c) => c.glyph).join(' ')}</span>
            </span>
          </button>

          <p className="pop-pick">ステージを選ぶ</p>
          <div className="pop-stages">
            {POP_STAGES.map((s) => (
              <button
                key={s.id}
                className={`pop-stage ${s.id === stageId ? 'sel' : ''}`}
                onClick={() => setStageId(s.id)}
              >
                <Bubble item={s.chars[0]} size={38} hideLabel />
                <span className="pop-stage-no">{s.id}{save.cleared[recordKey(mode, s.id)] ? ' ★' : ''}</span>
                <strong>{s.title}</strong>
              </button>
            ))}
          </div>

          {!hasHindiVoice() && (
            <p className="pop-note">
              この端末にはヒンディー語(hi-IN)の音声が無いため、読み上げは鳴りません。ゲームは遊べます。
            </p>
          )}
        </div>
        {help && <HowTo mode={mode} onClose={() => setHelp(false)} />}
      </div>
    )
  }

  // ---------- プレイ ----------
  const cur = stage.chars[Math.min(nextLevel, stage.chars.length - 1)]
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
            {/* 読みモードでは、まだ出ていない文字のローマ字は隠す(進化バーが答えの一覧にならないように) */}
            <Bubble item={c} size={42} active={i === nextLevel} dim={i > unlocked} hideLabel={mode === 'read' && i > unlocked} />
            <span className="pop-arrow">▸</span>
          </span>
        ))}
        {/* 最終形の進化: 👑2 → 💎4 → 🌈8 → 次のステージ。到達した段階が点灯する */}
        {FINAL_TIERS.slice(1).map((f) => (
          <span key={f.tier} className="pop-chain-item">
            <span className={`pop-tier ${tier >= f.tier ? 'on' : ''}`} style={{ '--tc': f.color }}>
              <span className="pop-tier-icon">{f.icon}</span>
              <span className="pop-tier-n">{f.badge}</span>
            </span>
            <span className="pop-arrow">▸</span>
          </span>
        ))}
        <span className="pop-tier next">NEXT</span>
      </div>

      <div className="pop-bar">
        <span className="pop-pill sm">Lv <strong>{save.level}</strong></span>
        <div className="pop-exp"><div style={{ width: `${Math.min(100, (save.exp / need) * 100)}%` }} /></div>
        <span className="pop-pill sm">⭐ <strong>{score}</strong></span>
        <span className="pop-pill sm">👑 <strong>{Math.max(save.best[recordKey(mode, stageId)] || 0, 0)}</strong></span>
      </div>

      <div className="pop-field">
        <canvas ref={canvasRef} className="pop-canvas" />
        {hint && !over && <div className="pop-hand">👆</div>}

        {toast?.kind === 'level' && (
          <div className="pop-toast">
            ✨ Lv {toast.level} ✨
          </div>
        )}
        {(toast?.kind === 'tier' || toast?.kind === 'clear') && (
          <div className="pop-toast">{toast.text}<small>{toast.sub}</small></div>
        )}

        {over && (
          <div className="pop-overlay in-field">
            <div className="pop-card">
              <h2>{over.grand ? '🏆 ALL CLEAR!' : 'Finish! 🎉'}</h2>
              <div className="pop-score">
                <span>SCORE</span>
                <strong>{over.score}</strong>
                <small>BEST {Math.max(save.best[recordKey(mode, stageId)] || 0, over.score)}</small>
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
        {mode === 'read' ? (
          // 読みモードでは文字・ローマ字を出さない(答えになるため)。聞きたいときだけ発音を鳴らす
          <button className="btn" onClick={listen}>🔊 次のメダルの発音を聞く</button>
        ) : (
          <button className="btn" onClick={listen}>
            🔊 <span className="pop-listen-glyph">{cur.glyph}</span> <small>{cur.label}</small>
          </button>
        )}
      </div>
      {help && <HowTo mode={mode} onClose={() => setHelp(false)} />}
    </div>
  )
}
