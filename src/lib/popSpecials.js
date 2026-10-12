// ポップの特別メダル。盤面が詰まったときに文字を消せるアイテムで、通常の文字とは別に降ってくる。
//   虹     : 触れた文字を1つ進化させる(ワイルド)
//   ダイヤ : 触れた文字と同じ文字を、盤面から全部消す
//   クラウン: 触れると盤面を全部消す(レア)
export const SPECIALS = {
  rainbow: {
    id: 'rainbow', icon: '🌈', name: '虹', desc: '触れた文字が1つ進化する',
    radius: 42, accent: '#ff9ad5', colors: ['#ff4d4d', '#ff9a2e', '#f2d03b', '#3ddc84', '#38d0f0', '#a070ff'],
  },
  diamond: {
    id: 'diamond', icon: '💎', name: 'ダイヤ', desc: '触れた文字と同じ文字を全部消す',
    radius: 42, accent: '#58d8ff', colors: ['#58d8ff', '#bff3ff', '#ffffff', '#3f7fe0'],
  },
  crown: {
    id: 'crown', icon: '👑', name: 'クラウン', desc: '触れると盤面を全部消す',
    radius: 46, accent: '#ffcf4a', colors: ['#ffcf4a', '#ffe9a0', '#ffffff', '#e0902f'],
  },
}

const RAINBOW = ['#ff4d4d', '#ff9a2e', '#f2d03b', '#3ddc84', '#38d0f0', '#4f7cff', '#a070ff']

// 以下は単位円(半径1)の座標で描くアイコン。s で拡大して使う
const drawRainbow = (ctx, s) => {
  ctx.lineCap = 'butt'
  RAINBOW.forEach((c, i) => {
    ctx.strokeStyle = c
    ctx.lineWidth = s * 0.085
    ctx.beginPath()
    ctx.arc(0, s * 0.2, s * (0.6 - i * 0.075), Math.PI, Math.PI * 2)
    ctx.stroke()
  })
}

const drawGem = (ctx, s) => {
  const P = (x, y) => [x * s, y * s]
  const pts = [P(-0.3, -0.42), P(0.3, -0.42), P(0.5, -0.1), P(0, 0.52), P(-0.5, -0.1)]
  const g = ctx.createLinearGradient(-s * 0.5, -s * 0.4, s * 0.5, s * 0.5)
  g.addColorStop(0, '#e6fbff')
  g.addColorStop(0.5, '#58d8ff')
  g.addColorStop(1, '#2f7fe0')
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = Math.max(1.5, s * 0.04)
  ctx.lineJoin = 'round'
  ctx.stroke()
  // ファセット(面の切れ目)
  ctx.beginPath()
  ctx.moveTo(...P(-0.5, -0.1)); ctx.lineTo(...P(0.5, -0.1))
  ctx.moveTo(...P(-0.3, -0.42)); ctx.lineTo(...P(-0.14, -0.1)); ctx.lineTo(...P(0, 0.52))
  ctx.moveTo(...P(0.3, -0.42)); ctx.lineTo(...P(0.14, -0.1)); ctx.lineTo(...P(0, 0.52))
  ctx.lineWidth = Math.max(1, s * 0.025)
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.stroke()
}

const drawCrown = (ctx, s) => {
  const P = (x, y) => [x * s, y * s]
  const pts = [P(-0.52, 0.34), P(-0.52, -0.3), P(-0.26, -0.02), P(0, -0.46), P(0.26, -0.02), P(0.52, -0.3), P(0.52, 0.34)]
  const g = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.4)
  g.addColorStop(0, '#fff0b0')
  g.addColorStop(0.55, '#ffcf4a')
  g.addColorStop(1, '#d98a1f')
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = '#8a5410'
  ctx.lineWidth = Math.max(1.5, s * 0.045)
  ctx.lineJoin = 'round'
  ctx.stroke()
  // 下の帯と、先端の宝石
  ctx.fillStyle = 'rgba(138, 84, 16, 0.55)'
  ctx.fillRect(-s * 0.52, s * 0.2, s * 1.04, s * 0.1)
  for (const [x, y, c] of [[-0.52, -0.3, '#ff5a5a'], [0, -0.46, '#58d8ff'], [0.52, -0.3, '#ff5a5a']]) {
    ctx.beginPath()
    ctx.arc(x * s, y * s, s * 0.085, 0, Math.PI * 2)
    ctx.fillStyle = c
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = Math.max(1, s * 0.025)
    ctx.stroke()
  }
}

const ICONS = { rainbow: drawRainbow, diamond: drawGem, crown: drawCrown }

/**
 * 特別メダルを描く。通常の文字メダルと同じ暗い円盤+リングだが、リングは白銀(虹)/水色/金で区別し、
 * 中身は文字ではなくアイコン+日本語名にする。
 */
export const drawSpecial = (ctx, x, y, kind, { scale = 1, alpha = 1, t = 0 } = {}) => {
  const sp = SPECIALS[kind]
  const s = sp.radius * scale
  const pulse = 0.5 + 0.5 * Math.sin(t / 260) // 特別メダルは常にゆっくり明滅させて目立たせる
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)

  ctx.save()
  ctx.globalAlpha = alpha * 0.4
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(0, s * 0.88, s * 0.78, s * 0.15, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const body = ctx.createRadialGradient(-s * 0.3, -s * 0.4, s * 0.05, 0, 0, s * 1.05)
  body.addColorStop(0, '#2b3a50')
  body.addColorStop(0.7, '#141d2b')
  body.addColorStop(1, '#0a1019')
  ctx.beginPath()
  ctx.arc(0, 0, s, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.shadowColor = sp.accent
  ctx.shadowBlur = s * (0.35 + 0.35 * pulse)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0

  // リング。虹だけは7色のグラデーション、他はアクセント色
  const rw = Math.max(3, s * 0.12)
  let rim = sp.accent
  if (kind === 'rainbow') {
    rim = ctx.createLinearGradient(-s, 0, s, 0)
    RAINBOW.forEach((c, i) => rim.addColorStop(i / (RAINBOW.length - 1), c))
  }
  ctx.lineWidth = rw
  ctx.strokeStyle = rim
  ctx.beginPath()
  ctx.arc(0, 0, s - rw / 2, 0, Math.PI * 2)
  ctx.stroke()

  // アイコン
  ctx.save()
  ctx.translate(0, -s * 0.12)
  ICONS[kind](ctx, s * 0.78)
  ctx.restore()

  // 名前(日本語)
  const fs = Math.max(11, s * 0.27)
  ctx.font = `800 ${fs}px "Noto Sans JP", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = fs * 0.3
  ctx.strokeStyle = 'rgba(5, 9, 16, 0.95)'
  ctx.strokeText(sp.name, 0, s * 0.62)
  ctx.fillStyle = '#fff'
  ctx.fillText(sp.name, 0, s * 0.62)

  ctx.restore()
}
