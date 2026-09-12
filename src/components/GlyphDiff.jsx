import { useEffect, useRef, useState } from 'react'
import { diffFace } from '../data/pairs'
import SpeakButton from './SpeakButton'

const FONT_STACK = '"Noto Sans Devanagari", "Nirmala UI", "Mangal", "Kohinoor Devanagari", serif'

// 共通部分=くすんだ紫グレー / 増えた部分=黄 / 消えた部分=ピンク
const C_SHARED = [150, 144, 180]
const C_ADDED = [251, 191, 36]
const C_REMOVED = [244, 114, 182]
const SHARED_DIM = 0.4 // 共通部分は薄く落として差分を目立たせる

// 文字を1枚のオフスクリーンcanvasに描いて、アルファ値だけの配列にする
const rasterize = (text, { fontPx, w, h, padX, baseline, dpr }) => {
  const c = document.createElement('canvas')
  c.width = Math.round(w * dpr)
  c.height = Math.round(h * dpr)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.scale(dpr, dpr)
  ctx.font = `${fontPx}px ${FONT_STACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#fff'
  ctx.fillText(text, padX, baseline)
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const alpha = new Uint8Array(c.width * c.height)
  let ink = 0
  for (let i = 0, p = 0; p < alpha.length; i += 4, p++) {
    alpha[p] = img.data[i + 3]
    if (img.data[i + 3] > 24) ink++
  }
  return { alpha, width: c.width, height: c.height, ink }
}

// B を shift だけ横にずらしたときの重なり量
const overlapScore = (A, B, shift, step) => {
  const { alpha: ga, width: W, height: H } = A
  const gb = B.alpha
  let sum = 0
  for (let y = 0; y < H; y += step) {
    const row = y * W
    for (let x = 0; x < W; x += step) {
      const a = ga[row + x]
      if (!a) continue
      const sx = x - shift
      if (sx < 0 || sx >= W) continue
      const b = gb[row + sx]
      if (b) sum += a < b ? a : b
    }
  }
  return sum
}

// 重なりが最大になる横ずらし量を探す(粗く探して周辺を1px刻みで詰める)
const bestShift = (A, B, maxShift) => {
  let coarse = 0
  let coarseScore = -1
  for (let s = -maxShift; s <= maxShift; s += 4) {
    const v = overlapScore(A, B, s, 4)
    if (v > coarseScore) {
      coarseScore = v
      coarse = s
    }
  }
  let best = coarse
  let bestScore = -1
  for (let s = coarse - 4; s <= coarse + 4; s++) {
    const v = overlapScore(A, B, s, 1)
    if (v > bestScore) {
      bestScore = v
      best = s
    }
  }
  return best
}

/** 2文字を重ねた差分画像を canvas に描く。戻り値は増減ピクセル数 */
const drawDiff = (canvas, textA, textB, fontPx) => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.round(fontPx * 2.1)
  const h = Math.round(fontPx * 1.95)
  const opts = { fontPx, w, h, padX: fontPx * 0.3, baseline: h * 0.72, dpr }

  const A = rasterize(textA, opts)
  const B = rasterize(textB, opts)
  if (!A.ink || !B.ink) return null

  // 縦は同じベースラインで描いているので、横方向だけ揃えれば重なる
  const shift = bestShift(A, B, Math.round(fontPx * 0.9 * dpr))

  canvas.width = A.width
  canvas.height = A.height
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext('2d')
  const out = ctx.createImageData(A.width, A.height)
  const W = A.width
  const H = A.height
  let added = 0
  let removed = 0

  for (let y = 0; y < H; y++) {
    const row = y * W
    for (let x = 0; x < W; x++) {
      const p = row + x
      const sx = x - shift
      const a = A.alpha[p]
      const b = sx >= 0 && sx < W ? B.alpha[row + sx] : 0
      const shared = a < b ? a : b
      const addOnly = b - shared
      const remOnly = a - shared
      const sw = shared * SHARED_DIM
      const total = sw + addOnly + remOnly
      if (total <= 0) continue
      const i = p * 4
      out.data[i] = (C_SHARED[0] * sw + C_ADDED[0] * addOnly + C_REMOVED[0] * remOnly) / total
      out.data[i + 1] = (C_SHARED[1] * sw + C_ADDED[1] * addOnly + C_REMOVED[1] * remOnly) / total
      out.data[i + 2] = (C_SHARED[2] * sw + C_ADDED[2] * addOnly + C_REMOVED[2] * remOnly) / total
      out.data[i + 3] = total > 255 ? 255 : total
      // 輪郭のアンチエイリアスを差分と数えないよう、はっきり差が出た点だけ数える
      if (addOnly > 110) added++
      if (remOnly > 110) removed++
    }
  }
  ctx.putImageData(out, 0, 0)
  return { added, removed }
}

/**
 * 2文字を実際のフォントで描画し、ピクセル差分で違いを色分けして見せる。
 * a を下敷き、b を重ねる側とする。
 */
export default function GlyphDiff({ a, b, size = 92, compact = false }) {
  const canvasRef = useRef(null)
  const [stats, setStats] = useState(null)
  const [failed, setFailed] = useState(false)

  const faceA = diffFace(a)
  const faceB = diffFace(b)

  useEffect(() => {
    let cancelled = false
    const paint = () => {
      if (cancelled || !canvasRef.current) return
      try {
        const s = drawDiff(canvasRef.current, faceA.text, faceB.text, size)
        setStats(s)
        setFailed(!s)
      } catch {
        setFailed(true)
      }
    }
    // Webフォントの読み込み後に描かないと、字形が変わってしまう
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint, paint)
    else paint()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, b.id, size])

  return (
    <div className={`gdiff ${compact ? 'compact' : ''}`}>
      <div className="gdiff-row">
        <div className="gdiff-cell">
          <span className="gdiff-glyph">{faceA.text}</span>
          <em>{faceA.read}</em>
          {!compact && <SpeakButton char={a} size="sm" />}
        </div>
        <span className="gdiff-op">と</span>
        <div className="gdiff-cell">
          <span className="gdiff-glyph">{faceB.text}</span>
          <em>{faceB.read}</em>
          {!compact && <SpeakButton char={b} size="sm" />}
        </div>
      </div>

      <div className="gdiff-arrow">↓ 重ねると</div>

      <div className="gdiff-canvas-wrap">
        {failed ? (
          <p className="gdiff-fallback">この環境では重ね表示を作れませんでした。</p>
        ) : (
          <canvas ref={canvasRef} className="gdiff-canvas" />
        )}
      </div>

      {!failed && (
        <div className="gdiff-legend">
          <span className="lg shared">共通</span>
          {stats?.added >= 10 && <span className="lg added">増えた部分</span>}
          {stats?.removed >= 10 && <span className="lg removed">消えた部分</span>}
        </div>
      )}
    </div>
  )
}
