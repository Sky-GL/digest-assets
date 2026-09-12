import { useState } from 'react'
import { speak, speakText } from '../lib/speech'

// 発音ボタン: TTS→mp3の順に試し、どちらも不可なら注意表示
export default function SpeakButton({ char, text, size = 'md', label = '発音' }) {
  const [state, setState] = useState('idle') // idle | playing | unavailable

  const handle = async (e) => {
    e.stopPropagation()
    setState('playing')
    const used = text ? await speakText(text) : await speak(char)
    setState(used === 'none' ? 'unavailable' : 'idle')
    if (used === 'none') setTimeout(() => setState('idle'), 2500)
  }

  return (
    <button
      className={`speak-btn ${size} ${state}`}
      onClick={handle}
      title={state === 'unavailable' ? 'この環境では音声が利用できません' : 'ヒンディー語で発音'}
    >
      <span className="speak-icon">{state === 'unavailable' ? '🔇' : '🔊'}</span>
      {size !== 'sm' && <span>{state === 'unavailable' ? '音声なし' : label}</span>}
    </button>
  )
}
