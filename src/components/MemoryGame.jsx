import { useEffect, useState } from 'react'
import { ALL_CHARS, syllable, charById } from '../data/steps'
import { shuffle } from '../data/words'
import { playCorrect, playWrong, playClear } from '../lib/sfx'
import { speakText } from '../lib/speech'

const PAIR_COUNT = 6 // 6ペア=12枚。スマホで一画面に収まる量

/** 文字カードに出す見た目。マートラは単体だと分かりにくいので क に付けた音節で見せる */
const faceOf = (char) => {
  if (char.group === 'matra') {
    const s = syllable(charById('ka'), char)
    return { glyph: s.devanagari, read: s.iast, kana: s.kana || char.kana, speak: s.devanagari }
  }
  return { glyph: char.devanagari, read: char.iast, kana: char.kana, speak: char.devanagari }
}

/** 出題対象の文字を選ぶ。学習済みを優先し、足りなければ頻出(core)から補う */
const pickChars = (learnedIds) => {
  const learned = ALL_CHARS.filter((c) => learnedIds.has(c.id))
  const core = ALL_CHARS.filter((c) => c.freq === 'core' && !learnedIds.has(c.id))
  const pool = [...shuffle(learned), ...shuffle(core), ...shuffle(ALL_CHARS)]
  const picked = []
  const seen = new Set()
  for (const c of pool) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    picked.push(c)
    if (picked.length >= PAIR_COUNT) break
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

export default function MemoryGame({ learnedIds, onBack, onAnswer }) {
  // 出題対象と手札はラウンド開始時に確定させる。
  // プレイ中の onAnswer で学習記録が更新されても配り直さないよう、props は依存にしない。
  const [round, setRound] = useState(() => {
    const picked = pickChars(learnedIds)
    return { chars: picked, deck: buildDeck(picked), startedAt: Date.now() }
  })
  const { chars, deck, startedAt } = round
  const [flipped, setFlipped] = useState([]) // 今めくっている札(最大2)
  const [matched, setMatched] = useState(new Set())
  const [moves, setMoves] = useState(0)
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const cleared = matched.size === chars.length * 2

  const nextRound = () => {
    const picked = pickChars(learnedIds)
    setRound({ chars: picked, deck: buildDeck(picked), startedAt: Date.now() })
    setFlipped([])
    setMatched(new Set())
    setMoves(0)
    setBusy(false)
    setElapsed(0)
  }

  // 経過時間(クリアで止める)
  useEffect(() => {
    if (cleared) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500)
    return () => clearInterval(t)
  }, [cleared, startedAt])

  useEffect(() => {
    if (cleared) playClear()
  }, [cleared])

  const flip = (card) => {
    if (busy || matched.has(card.key) || flipped.some((f) => f.key === card.key)) return
    if (card.kind === 'glyph' || card.kind === 'read') speakText(card.face.speak)

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
            <p>文字カードと読みカードのペアを揃える。めくるたびに発音が鳴ります。</p>
          </div>
        </div>
      </div>

      <div className="mem-stats">
        <span>めくった回数 <strong>{moves}</strong></span>
        <span>経過 <strong>{elapsed}</strong> 秒</span>
        <span>そろった <strong>{matched.size / 2}</strong> / {chars.length}</span>
      </div>

      <div className="mem-grid">
        {deck.map((card) => {
          const isOpen = matched.has(card.key) || flipped.some((f) => f.key === card.key)
          return (
            <button
              key={card.key}
              className={`mem-card ${isOpen ? 'open' : ''} ${matched.has(card.key) ? 'matched' : ''}`}
              onClick={() => flip(card)}
              disabled={matched.has(card.key)}
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
            <button className="btn primary" onClick={nextRound}>次のカードで挑戦</button>
          </div>
        </div>
      )}
    </div>
  )
}
