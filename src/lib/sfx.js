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

/** ユーザー操作内で呼んで AudioContext を解錠する */
export const unlockAudio = () => {
  try {
    getCtx()
  } catch {
    /* noop */
  }
}

/** ポップ: 文字を落とした音 */
export const playPopDrop = () => {
  try {
    tone(760, 0, 0.09, { peak: 0.07 })
    tone(500, 0.04, 0.08, { peak: 0.05 })
  } catch {
    /* noop */
  }
}

/** ポップ: 合体音。進化するほど高く、最終形は音を足して華やかに */
export const playPopMerge = (level, big = false) => {
  try {
    const f = 520 * Math.pow(1.06, level)
    tone(f, 0, 0.16, { peak: 0.07 })
    tone(f * 1.5, 0.05, 0.18, { peak: 0.055 })
    tone(f * 2, 0.1, 0.22, { peak: 0.04 })
    if (big) {
      tone(f * 2.5, 0.2, 0.3, { peak: 0.05 })
      tone(f * 3, 0.3, 0.35, { peak: 0.045 })
    }
  } catch {
    /* noop */
  }
}

/** ポップ: ゲーム終了 */
export const playPopFinish = () => {
  try {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, { peak: 0.06 }))
  } catch {
    /* noop */
  }
}

/** ポップ: 最終形が 👑/💎/🌈 に進化したときの効果音。虹=上昇アルペジオ / ダイヤ=きらめき / クラウン=ファンファーレ */
export const playPopSpecial = (kind) => {
  try {
    const seq =
      kind === 'rainbow' ? [523, 587, 659, 784, 880, 1047]
        : kind === 'diamond' ? [1568, 1976, 2349, 1976, 2637]
          : [523, 659, 784, 1047, 1319]
    seq.forEach((f, i) => tone(f, i * 0.07, kind === 'diamond' ? 0.16 : 0.28, { type: kind === 'diamond' ? 'triangle' : 'sine', peak: 0.07 }))
  } catch {
    /* noop */
  }
}
