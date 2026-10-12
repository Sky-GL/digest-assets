import Matter from 'matter-js'
import { shade } from '../data/popStages'
import { spawnPool } from './popStore'
import { playPopDrop, playPopMerge, playPopFinish, unlockAudio } from './sfx'
import { primeSpeech, speakText } from './speech'

// 「文字ゼリー」を落として、同じ文字同士を合体させて次の文字に進化させるマージゲームの本体。
// 物理は matter-js、描画は Canvas。React からは mount()/destroy() とコールバックだけで使う。

const { Engine, Bodies, Composite, Events, World } = Matter

export const W = 420
export const H = 660
const WALL = 60
const LINE_Y = 118 // この線より上にゼリーがはみ出し続けるとゲームオーバー
const SPAWN_Y = 62
const DROP_COOLDOWN = 380 // ms
const OVER_MS = 1600
const STEP = 1000 / 60
const FONT = '"Noto Sans Devanagari", "Nirmala UI", "Kohinoor Devanagari", sans-serif'

// ---------- パーティクル ----------
const PARTICLE_COLORS = ['#FF9EC4', '#FFD59E', '#FFF6A8', '#B7F2D6', '#C4DFFF', '#E0C8FF', '#FFFFFF']

const burst = (list, x, y, power = 1) => {
  const n = 15 + Math.floor(Math.random() * 6)
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.4
    const v = (2.4 + Math.random() * 3.6) * power
    list.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 1.2,
      life: 1,
      maxLife: 0.6 + Math.random() * 0.4,
      size: (5 + Math.random() * 7) * power,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      kind: i % 3 === 0 ? 'heart' : i % 3 === 1 ? 'star' : 'bubble',
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    })
  }
}

const stepParticles = (list, dt) => {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.18
    p.vx *= 0.98
    p.vy *= 0.98
    p.rot += p.vr
    p.life -= dt / p.maxLife
    if (p.life <= 0) list.splice(i, 1)
  }
}

const heart = (ctx, size) => {
  const n = size * 0.5
  ctx.beginPath()
  ctx.moveTo(0, n * 0.55)
  ctx.bezierCurveTo(-n * 1.3, -n * 0.5, -n * 0.45, -n * 1.35, 0, -n * 0.45)
  ctx.bezierCurveTo(n * 0.45, -n * 1.35, n * 1.3, -n * 0.5, 0, n * 0.55)
  ctx.closePath()
  ctx.fill()
}

const sparkle = (ctx, size) => {
  const n = size * 0.6
  const k = size * 0.16
  ctx.beginPath()
  ctx.moveTo(0, -n)
  ctx.quadraticCurveTo(k, -k, n, 0)
  ctx.quadraticCurveTo(k, k, 0, n)
  ctx.quadraticCurveTo(-k, k, -n, 0)
  ctx.quadraticCurveTo(-k, -k, 0, -n)
  ctx.closePath()
  ctx.fill()
}

const drawParticles = (ctx, list) => {
  for (const p of list) {
    const life = Math.max(0, Math.min(1, p.life))
    const size = p.size * (0.6 + life * 0.6)
    ctx.save()
    ctx.globalAlpha = life
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.fillStyle = p.color
    if (p.kind === 'heart') heart(ctx, size)
    else if (p.kind === 'star') sparkle(ctx, size)
    else {
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}

// ---------- ゼリーの描画 ----------
const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export const drawJelly = (ctx, x, y, item, { scale = 1, alpha = 1, squash = 0 } = {}) => {
  const s = item.radius * scale
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.scale(1 + squash, 1 - squash)

  // 影
  ctx.save()
  ctx.globalAlpha = alpha * 0.1
  ctx.fillStyle = '#7A5B86'
  ctx.beginPath()
  ctx.ellipse(0, s * 0.82, s * 0.78, s * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 本体
  const body = ctx.createRadialGradient(-s * 0.3, -s * 0.4, s * 0.1, 0, s * 0.1, s * 1.15)
  body.addColorStop(0, shade(item.base, 0.7))
  body.addColorStop(0.42, shade(item.base, 0.12))
  body.addColorStop(1, shade(item.base, -0.1))
  ctx.beginPath()
  ctx.arc(0, 0, s, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.shadowColor = 'rgba(165, 130, 190, 0.18)'
  ctx.shadowBlur = s * 0.22
  ctx.shadowOffsetY = s * 0.12
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // 下側の陰とふちのハイライト
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, s, 0, Math.PI * 2)
  ctx.clip()
  const under = ctx.createRadialGradient(0, s * 0.45, s * 0.35, 0, s * 0.45, s * 1.35)
  under.addColorStop(0, 'rgba(0,0,0,0)')
  under.addColorStop(1, 'rgba(150, 105, 160, 0.16)')
  ctx.fillStyle = under
  ctx.fillRect(-s, -s, s * 2, s * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = Math.max(1.5, s * 0.06)
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.99, Math.PI * 1.05, Math.PI * 1.95)
  ctx.stroke()
  ctx.restore()

  // つや・ほっぺ
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.ellipse(-s * 0.38, -s * 0.5, s * 0.26, s * 0.15, -0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = alpha * 0.6
  ctx.beginPath()
  ctx.ellipse(s * 0.42, -s * 0.42, s * 0.15, s * 0.09, 0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = alpha * 0.5
  ctx.fillStyle = '#FF8FB0'
  ctx.beginPath()
  ctx.ellipse(-s * 0.52, s * 0.18, s * 0.16, s * 0.11, 0, 0, Math.PI * 2)
  ctx.ellipse(s * 0.52, s * 0.18, s * 0.16, s * 0.11, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 目(横線で幅が広いので、文字(幅±0.45s)より外側に置く)
  const eyeY = -s * 0.02
  const eyeX = s * 0.6
  const eyeR = Math.max(1.6, s * 0.075)
  ctx.fillStyle = '#5A4152'
  for (const d of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(d * eyeX, eyeY, eyeR, eyeR * 1.15, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  for (const d of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(d * eyeX - eyeR * 0.3, eyeY - eyeR * 0.4, eyeR * 0.42, 0, Math.PI * 2)
    ctx.fill()
  }

  // デーヴァナーガリー文字: 幅が目の内側に収まるよう、長い結合文字は縮小する
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let size = s * 0.78
  ctx.font = `700 ${size}px ${FONT}`
  const w = ctx.measureText(item.glyph).width
  const maxW = s * 0.9
  if (w > maxW) {
    size *= maxW / w
    ctx.font = `700 ${size}px ${FONT}`
  }
  ctx.fillStyle = 'rgba(105, 72, 98, 0.95)'
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = s * 0.12
  ctx.lineJoin = 'round'
  ctx.strokeText(item.glyph, 0, -s * 0.04)
  ctx.fillText(item.glyph, 0, -s * 0.04)

  // ローマ字(IAST)
  ctx.font = `700 ${Math.max(8, s * 0.28)}px "Noto Sans JP", system-ui, sans-serif`
  ctx.fillStyle = 'rgba(120, 88, 115, 0.9)'
  ctx.lineWidth = s * 0.06
  ctx.strokeText(item.label, 0, s * 0.58)
  ctx.fillText(item.label, 0, s * 0.58)

  ctx.restore()
}

const popCurve = (v) => (v <= 0 ? 0 : Math.sin(v * Math.PI * 0.9))

// ---------- ゲーム本体 ----------
export class PopEngine {
  /**
   * @param stage        POP_STAGES の1要素
   * @param playerLevel  プレイヤーLv(出現する文字の大きさに影響)
   * @param cb           { onScore, onNext, onFirstInteract, onUnlock, onMerge, onStageClear, onFinish }
   */
  constructor(stage, playerLevel, cb) {
    this.cb = cb
    this.chars = stage.chars
    this.pool = spawnPool(playerLevel)
    this.engine = Engine.create()
    this.engine.gravity.y = 1.1
    this.particles = []
    this.score = 0
    this.aimX = W / 2
    this.pointerDown = false
    this.lastDrop = 0
    this.overTime = 0
    this.finished = false
    this.interacted = false
    this.accumulator = 0
    this.lastFrame = 0
    this.confettiT = 0
    this.rafId = 0
    this.nextLevel = this.rollSpawn()
  }

  get maxLevel() {
    return this.chars.length - 1
  }

  setPlayerLevel(level) {
    this.pool = spawnPool(level)
  }

  rollSpawn() {
    const lv = this.pool[Math.floor(Math.random() * this.pool.length)]
    return Math.min(lv, this.maxLevel)
  }

  mount(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.resize()

    const wall = { isStatic: true, restitution: 0.1, friction: 0.7 }
    Composite.add(this.engine.world, [
      Bodies.rectangle(W / 2, H + WALL / 2 - 6, W, WALL, wall),
      Bodies.rectangle(-WALL / 2 + 6, H / 2, WALL, H * 2, wall),
      Bodies.rectangle(W + WALL / 2 - 6, H / 2, WALL, H * 2, wall),
    ])
    Events.on(this.engine, 'collisionStart', this.onCollide)
    Events.on(this.engine, 'collisionActive', this.onCollide)
    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointermove', this.onMove)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('pointercancel', this.onUp)
    window.addEventListener('resize', this.resize)

    // Canvas描画は未ロードのWebフォントを自動では待たないので、先に読み込みを促しておく
    document.fonts?.load(`700 40px "Noto Sans Devanagari"`, 'अक').catch(() => {})

    this.cb.onNext(this.nextLevel)
    this.lastFrame = performance.now()
    this.loop(this.lastFrame)
  }

  destroy() {
    cancelAnimationFrame(this.rafId)
    const c = this.canvas
    c?.removeEventListener('pointerdown', this.onDown)
    c?.removeEventListener('pointermove', this.onMove)
    c?.removeEventListener('pointerup', this.onUp)
    c?.removeEventListener('pointercancel', this.onUp)
    window.removeEventListener('resize', this.resize)
    Events.off(this.engine, 'collisionStart', this.onCollide)
    Events.off(this.engine, 'collisionActive', this.onCollide)
    World.clear(this.engine.world, false)
    Engine.clear(this.engine)
  }

  restart() {
    for (const b of Composite.allBodies(this.engine.world)) {
      if (!b.isStatic) Composite.remove(this.engine.world, b)
    }
    this.particles.length = 0
    this.pointerDown = false
    this.lastDrop = 0
    this.score = 0
    this.overTime = 0
    this.accumulator = 0
    this.finished = false
    this.confettiT = 0
    this.nextLevel = this.rollSpawn()
    this.cb.onScore(0)
    this.cb.onNext(this.nextLevel)
  }

  // ---- 入力 ----
  resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    this.canvas.width = W * dpr
    this.canvas.height = H * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  toFieldX(e) {
    const r = this.canvas.getBoundingClientRect()
    return ((e.clientX - r.left) / r.width) * W
  }

  clampAim(x) {
    const r = this.chars[this.nextLevel].radius
    return Math.max(r + 6, Math.min(W - r - 6, x))
  }

  onDown = (e) => {
    if (this.finished) return
    // 音声はユーザー操作内でないと鳴らせない環境があるので、ここで解錠する
    unlockAudio()
    primeSpeech()
    this.pointerDown = true
    this.aimX = this.clampAim(this.toFieldX(e))
    this.canvas.setPointerCapture(e.pointerId)
  }

  onMove = (e) => {
    if (!this.pointerDown || this.finished) return
    this.aimX = this.clampAim(this.toFieldX(e))
  }

  onUp = (e) => {
    const was = this.pointerDown
    this.pointerDown = false
    if (!was || this.finished) return
    this.aimX = this.clampAim(this.toFieldX(e))
    this.drop()
    if (!this.interacted) {
      this.interacted = true
      this.cb.onFirstInteract()
    }
  }

  // ---- 物理 ----
  makeBall(x, y, level) {
    const c = this.chars[level]
    const b = Bodies.circle(x, y, c.radius, {
      restitution: 0.16,
      friction: 0.55,
      frictionStatic: 0.7,
      density: 0.0011,
      slop: 0.02,
    })
    b.jelly = { level, born: performance.now(), pop: 0, merging: false }
    return b
  }

  drop() {
    const now = performance.now()
    if (now - this.lastDrop < DROP_COOLDOWN) return
    this.lastDrop = now
    const lv = this.nextLevel
    Composite.add(this.engine.world, this.makeBall(this.aimX, SPAWN_Y, lv))
    playPopDrop()
    speakText(this.chars[lv].speak, { rate: 0.85, pitch: 1.2 })
    this.nextLevel = this.rollSpawn()
    this.cb.onNext(this.nextLevel)
  }

  onCollide = (ev) => {
    for (const pair of ev.pairs) {
      const a = pair.bodyA
      const b = pair.bodyB
      if (a.isStatic || b.isStatic) continue
      const ja = a.jelly
      const jb = b.jelly
      if (!ja || !jb || ja.merging || jb.merging) continue
      if (ja.level !== jb.level || ja.level >= this.maxLevel) continue
      ja.merging = true
      jb.merging = true
      this.merge(a, b, ja.level + 1)
    }
  }

  merge(a, b, level) {
    const x = (a.position.x + b.position.x) / 2
    const y = (a.position.y + b.position.y) / 2
    Composite.remove(this.engine.world, a)
    Composite.remove(this.engine.world, b)

    const isMax = level >= this.maxLevel
    const ball = this.makeBall(x, y, level)
    ball.jelly.pop = 1
    Composite.add(this.engine.world, ball)

    playPopMerge(level, isMax)
    speakText(this.chars[level].speak, { rate: 0.8, pitch: isMax ? 1.6 : 1.3 })
    burst(this.particles, x, y, isMax ? 1.6 : 1)

    this.score += (level + 1) * 10
    this.cb.onScore(this.score)
    this.cb.onUnlock(level)
    this.cb.onMerge(level)
    if (isMax) this.cb.onStageClear()
  }

  step(dt) {
    this.accumulator = Math.min(this.accumulator + dt * 1000, STEP * 5)
    while (this.accumulator >= STEP) {
      Engine.update(this.engine, STEP)
      this.accumulator -= STEP
    }
    stepParticles(this.particles, dt)

    // ラインを超えたまま一定時間たまっていたら終了(落としたてのゼリーは猶予)
    const now = performance.now()
    let over = false
    for (const b of Composite.allBodies(this.engine.world)) {
      if (b.isStatic || !b.jelly) continue
      const j = b.jelly
      j.pop = Math.max(0, j.pop - dt * 3.2)
      if (now - j.born > 900 && b.position.y - this.chars[j.level].radius < LINE_Y) over = true
    }
    this.overTime = over ? this.overTime + dt * 1000 : 0
    if (!this.finished && this.overTime > OVER_MS) this.finish()
  }

  finish() {
    this.finished = true
    playPopFinish()
    for (let i = 0; i < 4; i++) burst(this.particles, W * (0.2 + 0.2 * i), H * 0.4, 1.4)
    this.cb.onFinish(this.score)
  }

  loop = (t) => {
    this.rafId = requestAnimationFrame(this.loop)
    const dt = Math.min((t - this.lastFrame) / 1000, 0.05)
    this.lastFrame = t
    if (this.finished) {
      stepParticles(this.particles, dt)
      this.confettiT += dt
      if (this.confettiT > 0.55) {
        this.confettiT = 0
        burst(this.particles, Math.random() * W, -10, 1.1)
      }
    } else {
      this.step(dt)
    }
    this.render(t)
  }

  // ---- 描画 ----
  render(t) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, W, H)

    // フィールドの枠
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    roundRect(ctx, 6, 30, W - 12, H - 36, 28)
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.stroke()
    ctx.restore()

    // ゲームオーバーライン(はみ出していると濃く点滅)
    const danger = Math.min(1, this.overTime / OVER_MS)
    ctx.save()
    ctx.setLineDash([10, 10])
    ctx.lineWidth = 2 + danger * 2
    ctx.strokeStyle = `rgba(170, 140, 220, ${0.25 + danger * 0.45 + Math.sin(t / 220) * 0.12 * danger})`
    ctx.beginPath()
    ctx.moveTo(18, LINE_Y)
    ctx.lineTo(W - 18, LINE_Y)
    ctx.stroke()
    ctx.restore()

    // 次に落とす文字と狙い線
    if (!this.finished) {
      const next = this.chars[this.nextLevel]
      ctx.save()
      ctx.setLineDash([6, 12])
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(this.aimX, SPAWN_Y + next.radius)
      ctx.lineTo(this.aimX, H - 20)
      ctx.stroke()
      ctx.restore()
      const bob = this.pointerDown ? 0 : Math.sin(t / 420) * 3
      drawJelly(ctx, this.aimX, SPAWN_Y + bob, next, { alpha: 0.96 })
    }

    for (const b of Composite.allBodies(this.engine.world)) {
      if (b.isStatic || !b.jelly) continue
      const pop = popCurve(b.jelly.pop)
      drawJelly(ctx, b.position.x, b.position.y, this.chars[b.jelly.level], {
        scale: 1 + 0.2 * pop,
        squash: -0.05 * pop,
      })
    }

    drawParticles(ctx, this.particles)
  }
}
