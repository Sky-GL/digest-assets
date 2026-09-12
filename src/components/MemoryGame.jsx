import { useEffect, useState } from 'react'
import { ALL_CHARS, syllable, charById } from '../data/steps'
import { shuffle } from '../data/words'
import { playCorrect, playWrong, playClear } from '../lib/sfx'
import { speakText } from '../lib/speech'

// 難易度。6ペアはいきなりだと覚えきれないという声を受けて、既定は4ペア(8枚)にした
const LEVELS = [
  { key: 'easy', label: 'やさしい', pairs: 3, peek: 3000 },
  { key: 'normal', label: 'ふつう', pairs: 4, peek: 2500 },
  { key: 'hard', label: 'むずかしい', pairs: 6, peek: 2000 },
]
const DEFAULT_LEVEL = 'normal'
const levelOf = (key) => LEVELS.find((l) => l.key === key) || LEVELS[1]

/** 文字カードに出す見た目。マートラは単体だと分かりにくいので क に付けた音節で見せる */
const faceOf = (char) => {
  if (char.group === 'matra') {
    const s = syllable(charById('ka'), char)
    return { glyph: s.devanagari, read: s.iast, kana: s.kana || char.kana, speak: s.devanagari }
  }
  return { glyph: char.devanagari, read: char.iast, kana: char.kana, speak: char.devanagari }
}

/** 出題対象の文字を選ぶ。学習済みを優先し、足りなければ頻出(core)から補う */
const pickChars = (learnedIds, pairs) => {
  const learned = ALL_CHARS.filter((c) => learnedIds.has(c.id))
  const core = ALL_CHARS.filter((c) => c.freq === 'core' && !learnedIds.has(c.id))
  const pool = [...shuffle(learned), ...shuffle(core), ...shuffle(ALL_CHARS)]
  const picked = []
  const seen = new Set()
  for (const c of pool) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    picked.push(c)
    if (picked.length >= pairs) break
  }
  return picked
}

const buildDeck = (chars) =>
  shuffle(
    chars.flatMap((c) => {
      const f = faceOf(c)
      return [
        { key: `${c.id}-glyph`, charId: c.id, kind: 'glyph', face: f },
        { key: `${c.id}-read`, charId: c.id, kind: 'read', face: f },
      ]
    })
  )

const newRound = (learnedIds, levelKey) => {
  const lv = levelOf(levelKey)
  const chars = pickChars(learnedIds, lv.pairs)
  return { chars, deck: buildDeck(chars), peek: lv.peek, id: Date.now() }
}

export default function MemoryGame({ learnedIds, onBack, onAnswer }) {
  // 出題対象と手札はラウンド開始時に確定させる。
  // プレイ中の onAnswer で学習記録が更新されても配り直さないよう、props は依存にしない。
  const [level, setLevel] = useState(DEFAULT_LEVEL)
  const [round, setRound] = useState(() => newRound(learnedIds, DEFAULT_LEVEL))
  const { chars, deck } = round
  const [peeking, setPeeking] = useState(true) // 開始直後に全カードを見せている間
  const [startedAt, setStartedAt] = useState(0)
  const [flipped, setFlipped] = useState([]) // 今めくっている札(最大2)
  const [matched, setMatched] = useState(new Set())
  const [moves, setMoves] = useState(0)
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const cleared = matched.size === chars.length * 2

  const startRound = (levelKey) => {
    setLevel(levelKey)
    setRound(newRound(learnedIds, levelKey))
    setPeeking(true)
    setFlipped([])
    setMatched(new Set())
    setMoves(0)
    setBusy(false)
    setElapsed(0)
  }

  // 開始直後は全カードを数秒だけ見せる(全部裏からだと手掛かりがゼロで難しすぎる)
  useEffect(() => {
    setPeeking(true)
    const t = setTimeout(() => {
      setPeeking(false)
      setStartedAt(Date.now())
    }, round.peek)
    return () => clearTimeout(t)
  }, [round.id])

  // 経過時間(お披露目が終わってから計測、クリアで止める)
  useEffect(() => {
    if (cleared || peeking || !startedAt) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500)
    return () => clearInterval(t)
  }, [cleared, peeking, startedAt])

  useEffect(() => {
    if (cleared) playClear()
  }, [cleared])

  const flip = (card) => {
    if (peeking || busy || matched.has(card.key) || flipped.some((f) => f.key === card.key)) return
    speakText(card.face.speak)

    const next = [...flipped, card]
    setFlipped(next)
    if (next.length < 2) return

    setMoves((m) => m + 1)
    setBusy(true)
    const [a, b] = next
    const ok = a.charId === b.charId
    onAnswer(a.charId, ok)
    if (!ok) onAnswer(b.charId, false)

    if (ok) {
      playCorrect()
      setTimeout(() => {
        setMatched((prev) => new Set([...prev, a.key, b.key]))
        setFlipped([])
        setBusy(false)
      }, 420)
    } else {
      playWrong()
      setTimeout(() => {
        setFlipped([])
        setBusy(false)
      }, 900)
    }
  }

  return (
    <div className="screen memory" style={{ '--accent': '#c084fc' }}>
      <div className="screen-head">
        <button className="btn ghost" onClick={onBack}>← マップ</button>
        <div className="head-title">
          <span className="step-emoji">🃏</span>
          <div>
            <h2>神経衰弱</h2>
            <p>最初に全部のカードを数秒お披露目します。文字カードと読みカードのペアを揃えてください。</p>
          </div>
        </div>
      </div>

      <div className="level-row">
        {LEVELS.map((l) => (
          <button
            key={l.key}
            className={`level-chip ${level === l.key ? 'on' : ''}`}
            onClick={() => startRound(l.key)}
          >
            {l.label}
            <small>{l.pairs}ペア</small>
          </button>
        ))}
      </div>

      <div className="mem-stats">
        <span>めくった回数 <strong>{moves}</strong></span>
        <span>経過 <strong>{elapsed}</strong> 秒</span>
        <span>そろった <strong>{matched.size / 2}</strong> / {chars.length}</span>
      </div>

      {peeking && <div className="mem-peek-note">👀 いまのうちに覚えて！</div>}

      <div className={`mem-grid ${peeking ? 'peeking' : ''}`}>
        {deck.map((card) => {
          const isOpen = peeking || matched.has(card.key) || flipped.some((f) => f.key === card.key)
          return (
            <button
              key={card.key}
              className={`mem-card ${isOpen ? 'open' : ''} ${matched.has(card.key) ? 'matched' : ''}`}
              onClick={() => flip(card)}
              disabled={matched.has(card.key) || peeking}
            >
              {isOpen ? (
                card.kind === 'glyph' ? (
                  <span className="mem-glyph">{card.face.glyph}</span>
                ) : (
                  <span className="mem-read">
                    <span className="mr-iast">{card.face.read}</span>
                    <small>{card.face.kana}</small>
                  </span>
                )
              ) : (
                <span className="mem-back">क</span>
              )}
            </button>
          )
        })}
      </div>

      {cleared && (
        <div className="feedback ok mem-clear">
          <strong>🎉 クリア!</strong>
          <p>{moves} 回めくって {elapsed} 秒。最小 {chars.length} 回でそろえられます。</p>
          <div className="cta-row">
            <button className="btn" onClick={onBack}>マップへ戻る</button>
            <button className="btn primary" onClick={() => startRound(level)}>次のカードで挑戦</button>
          </div>
        </div>
      )}
    </div>
  )
}
