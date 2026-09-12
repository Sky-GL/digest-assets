// 発音再生: Web Speech API(hi-IN)を第一候補、非対応/音声なしなら mp3 にフォールバック

let cachedVoices = null

const loadVoices = () => {
  if (!('speechSynthesis' in window)) return []
  const v = window.speechSynthesis.getVoices()
  if (v.length) cachedVoices = v
  return cachedVoices || []
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices()
  window.speechSynthesis.onvoiceschanged = loadVoices
}

// hi-IN の音声があるか(なければ英語音声でデーヴァナーガリーを読ませても無意味なのでmp3へ)
export const hasHindiVoice = () => loadVoices().some((v) => /^hi(-|_)?/i.test(v.lang))

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

const playAudioFile = (url) =>
  new Promise((resolve, reject) => {
    if (!url) return reject(new Error('no audio url'))
    const audio = new Audio(url)
    audio.onended = () => resolve('file')
    audio.onerror = () => reject(new Error('audio file missing'))
    audio.play().catch(reject)
  })

/**
 * 文字を発音する。
 * @returns {Promise<'tts'|'file'|'none'>} 実際に使った手段
 */
export const speak = async (char, { rate = 0.75 } = {}) => {
  const text = char?.speak || char?.devanagari
  if (!text) return 'none'

  if (speechSupported() && hasHindiVoice()) {
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'hi-IN'
      u.rate = rate
      const voice = loadVoices().find((v) => /^hi(-|_)?/i.test(v.lang))
      if (voice) u.voice = voice
      window.speechSynthesis.speak(u)
      return 'tts'
    } catch {
      /* 下のフォールバックへ */
    }
  }

  try {
    await playAudioFile(char.audioUrl)
    return 'file'
  } catch {
    return 'none'
  }
}

// 任意の文字列(マートラ合成音節など)を読み上げる
export const speakText = async (text, { rate = 0.75 } = {}) => {
  if (!text || !speechSupported() || !hasHindiVoice()) return 'none'
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'hi-IN'
  u.rate = rate
  const voice = loadVoices().find((v) => /^hi(-|_)?/i.test(v.lang))
  if (voice) u.voice = voice
  window.speechSynthesis.speak(u)
  return 'tts'
}
