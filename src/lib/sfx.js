// 効果音。mp3を持たず、Web Audio API でその場に短い音を合成する。
// choose()などユーザー操作(クリック)のハンドラ内から呼ぶこと
// (ブラウザの自動再生制限に引っかからないよう、ユーザージェスチャー内で AudioContext を生成/再開する)。

let ctx = null

const getCtx = () => {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// 単音を鳴らす。start/dur は秒単位で現在時刻からの相対値
const tone = (freq, start, dur, { type = 'sine', peak = 0.18 } = {}) => {
  const c = getCtx()
  if (!c) return
  const t0 = c.currentTime + start
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** 正解: 明るい2音の「ピロン↑」 */
export const playCorrect = () => {
  try {
    tone(880.0, 0, 0.11, { type: 'sine', peak: 0.16 }) // A5
    tone(1318.5, 0.08, 0.2, { type: 'sine', peak: 0.14 }) // E6
  } catch {
    /* 音が鳴らなくても学習は続行できる */
  }
}

/** 不正解: 低めに落ちる短いブザー */
export const playWrong = () => {
  try {
    tone(220.0, 0, 0.16, { type: 'triangle', peak: 0.13 }) // A3
    tone(174.6, 0.07, 0.22, { type: 'triangle', peak: 0.11 }) // F3
  } catch {
    /* noop */
  }
}

/** Stepクリア: 3音の上昇アルペジオ */
export const playClear = () => {
  try {
    tone(659.3, 0, 0.12, { type: 'sine', peak: 0.15 }) // E5
    tone(830.6, 0.1, 0.12, { type: 'sine', peak: 0.15 }) // Ab5
    tone(1046.5, 0.2, 0.28, { type: 'sine', peak: 0.17 }) // C6
  } catch {
    /* noop */
  }
}
