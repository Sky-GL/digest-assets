import { useEffect, useMemo, useState } from 'react'
import { pickWords, charsOfWord, shuffle } from '../data/words'
import { syllable } from '../data/steps'
import SpeakButton from './SpeakButton'
import { speakText } from '../lib/speech'
import { playCorrect, playWrong, playClear } from '../lib/sfx'

/**
 * 単語を構成文字に分解して表示する。
 * 子音+マートラは1つの音節として並べたいので、マートラは直前の子音とまとめる。
 */
const toSyllables = (word) => {
  const chars = charsOfWord(word)
  const out = []
  for (const c of chars) {
    const prev = out[out.length - 1]
    if (c.group === 'matra' && prev && prev.base.group !== 'matra') {
      const s = syllable(prev.base, c)
      prev.matra = c
      prev.text = s.devanagari
      prev.read = s.iast
      prev.kana = s.kana || prev.base.kana
    } else {
      out.push({ base: c, matra: null, text: c.devanagari, read: c.iast, kana: c.kana })
    }
  }
  return out
}

export default function WordMode({ learnedIds, onBack, onAnswer }) {
  // 出題する単語はマウント時に確定させる。
  // 解答するたびに onAnswer で学習記録が変わるので、props を依存にすると途中で並びが変わってしまう。
  const [words] = useState(() => pickWords(learnedIds, 10))
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [lit, setLit] = useState(-1) // 音節を1つずつ光らせる位置
  const [quiz, setQuiz] = useState(null) // { options, picked }
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  const word = words[idx]
  const syls = useMemo(() => (word ? toSyllables(word) : []), [word])
  const total = words.length

  // 単語が変わったら状態をリセット
  useEffect(() => {
    setRevealed(false)
    setLit(-1)
    setQuiz(null)
  }, [idx])

  if (!word) {
    return (
      <div className="screen">
        <div className="screen-head">
          <button className="btn ghost" onClick={onBack}>← マップ</button>
        </div>
        <p className="hint-text">単語データが読み込めませんでした。</p>
      </div>
    )
  }

  if (done) {
    const rate = Math.round((score / total) * 100)
    return (
      <div className="screen result" style={{ '--accent': '#34d399' }}>
        <div className="result-badge ok">📖 単語モード終了</div>
        <h2>{score} / {total} 正解({rate}%)</h2>
        <p className="hint-text">読めた単語が増えるほど、文字も自然に定着します。</p>
        <div className="cta-row">
          <button className="btn" onClick={onBack}>マップへ戻る</button>
          <button className="btn primary" onClick={() => { setIdx(0); setScore(0); setDone(false) }}>もう一度</button>
        </div>
      </div>
    )
  }

  // 1音節ずつ光らせながら読み上げる
  const playAlong = async () => {
    for (let i = 0; i < syls.length; i++) {
      setLit(i)
      speakText(syls[i].text)
      await new Promise((r) => setTimeout(r, 620))
    }
    setLit(-1)
    speakText(word.devanagari)
  }

  const startQuiz = () => {
    // 意味あて4択。ダミーは他の単語の意味から
    const others = shuffle(words.filter((w) => w.id !== word.id)).slice(0, 3)
    setQuiz({ options: shuffle([word, ...others]), picked: null })
  }

  const answer = (picked) => {
    if (quiz.picked) return
    const ok = picked.id === word.id
    if (ok) {
      playCorrect()
      setScore((s) => s + 1)
    } else {
      playWrong()
    }
    // 単語を構成する文字の成績にも反映する
    word.chars.forEach((id) => onAnswer(id, ok))
    setQuiz((q) => ({ ...q, picked }))
  }

  const next = () => {
    if (idx + 1 >= total) {
      playClear()
      setDone(true)
    } else {
      setIdx(idx + 1)
    }
  }

  return (
    <div className="screen wordmode" style={{ '--accent': '#34d399' }}>
      <div className="screen-head">
        <button className="btn ghost" onClick={onBack}>← マップ</button>
        <div className="head-title">
          <span className="step-emoji">📖</span>
          <div>
            <h2>単語モード</h2>
            <p>覚えた文字が単語になると一気に読めるようになる。まず声に出してみる。</p>
          </div>
        </div>
      </div>

      <div className="quiz-head">
        <div className="quiz-bar"><div className="quiz-fill" style={{ width: `${(idx / total) * 100}%` }} /></div>
        <span className="quiz-count">{idx + 1}/{total}</span>
      </div>

      <div className="word-card">
        <div className="word-syls">
          {syls.map((s, i) => (
            <button
              key={i}
              className={`word-syl ${lit === i ? 'lit' : ''}`}
              onClick={() => speakText(s.text)}
              title="タップで発音"
            >
              <span className="ws-glyph">{s.text}</span>
              <em className="ws-read">{s.read}</em>
              {s.kana && <small className="ws-kana">{s.kana}</small>}
            </button>
          ))}
        </div>

        <div className="word-actions">
          <button className="btn secondary" onClick={playAlong}>🔉 1文字ずつ読む</button>
          <SpeakButton text={word.devanagari} label="通しで聞く" />
        </div>

        {revealed ? (
          <div className="word-answer">
            <div className="wa-kana">{word.kana}</div>
            <div className="wa-meaning">{word.meaning}</div>
            <div className="wa-iast">{word.iast}</div>
          </div>
        ) : (
          <button className="btn" onClick={() => setRevealed(true)}>読みと意味を見る</button>
        )}
      </div>

      {!quiz ? (
        <div className="cta-row">
          <button className="btn primary big" onClick={startQuiz}>意味を当てる</button>
        </div>
      ) : (
        <div className="word-quiz">
          <p className="quiz-sub">この単語の意味は?</p>
          <div className="options">
            {quiz.options.map((o) => {
              const state = !quiz.picked ? '' : o.id === word.id ? 'correct' : o.id === quiz.picked.id ? 'wrong' : 'dim'
              return (
                <button key={o.id} className={`option ${state}`} onClick={() => answer(o)} disabled={!!quiz.picked}>
                  {o.meaning}
                </button>
              )
            })}
          </div>
          {quiz.picked && (
            <div className={`feedback ${quiz.picked.id === word.id ? 'ok' : 'ng'}`}>
              <strong>{quiz.picked.id === word.id ? '正解!' : '惜しい!'}</strong>
              <p>{word.devanagari} = {word.kana}({word.iast}) — {word.meaning}</p>
              <button className="btn primary" onClick={next} autoFocus>
                {idx + 1 >= total ? '結果を見る' : '次の単語 →'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
