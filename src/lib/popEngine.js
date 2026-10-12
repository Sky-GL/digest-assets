import Matter from 'matter-js'
import { shade, withAlpha } from '../data/popStages'
import { spawnPool } from './popStore'
import { playPopDrop, playPopMerge, playPopFinish, unlockAudio } from './sfx'
import { primeSpeech, speakText } from './speech'

// 「文字メダル」を落として、同じ文字同士を合体させて次の文字に進化させるマージゲームの本体。
// 物理は matter-js、描画は Canvas。React からは mount()/destroy() とコールバックだけで使う。

const { Engine, Bodies, Composite, Events, World } = Matter

export const W = 420
export const H = 660
const WALL = 60
const LINE_Y = 118 // この線より上にメダルがはみ出し続けるとゲームオーバー
const SPAWN_Y = 62
const DROP_COOLDOWN = 380 // ms
const OVER_MS = 1600
const STEP = 1000 / 60
const FONT = '"Noto Sans Devanagari", "Nirmala UI", "Kohinoor Devanagari", sans-serif'

// ---------- パーティクル(火花・破片) ----------
const SPARK_COLORS = ['#f2c94c', '#e0902f', '#5aa0d6', '#e8eef7', '#3bb3a3']

const burst = (list, x, y, power = 1) => {
  const n = 16 + Math.floor(Math.random() * 6)
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.4
    const v = (2.6 + Math.random() * 4) * power
    list.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 1,
      life: 1,
      maxLife: 0.45 + Math.random() * 0.4,
      size: (4 + Math.random() * 7) * power,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      kind: i % 3 === 0 ? 'shard' : i % 3 === 1 ? 'spark' : 'ring',
      color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
    })
  }
}

const stepParticles = (list, dt) => {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.2
    p.vx *= 0.98
    p.vy *= 0.98
    p.rot += p.vr
    p.life -= dt / p.maxLife
    if (p.life <= 0) list.splice(i, 1)
  }
}

const drawParticles = (ctx, list) => {
  for (const p of list) {
    const life = Math.max(0, Math.min(1, p.life))
    const size = p.size * (0.5 + life * 0.7)
    ctx.save()
    ctx.globalAlpha = life
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.fillStyle = p.color
    ctx.strokeStyle = p.color
    if (p.kind === 'shard') {
      // 菱形の破片
      ctx.beginPath()
      ctx.moveTo(0, -size * 0.7)
      ctx.lineTo(size * 0.4, 0)
      ctx.lineTo(0, size * 0.7)
      ctx.lineTo(-size * 0.4, 0)
      ctx.closePath()
      ctx.fill()
    } else if (p.kind === 'spark') {
      // 細い火花の筋
      ctx.lineWidth = Math.max(1.5, size * 0.18)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-size * 0.8, 0)
      ctx.lineTo(size * 0.8, 0)
      ctx.stroke()
    } else {
      ctx.lineWidth = Math.max(1.5, size * 0.16)
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }
}

// ---------- メダルの描画 ----------
const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * 文字メダル: 暗いメタルの円盤に、レベル色の縁と発光する文字。
 * item.base がそのレベルのアクセント色。最終形は金の光輪(aura)をまとう。
 */
export const drawMedal = (ctx, x, y, item, { scale = 1, alpha = 1, squash = 0, aura = false } = {}) => {
  const s = item.radius * scale
  const accent = item.base
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.scale(1 + squash, 1 - squash)

  // 接地影
  ctx.save()
  ctx.globalAlpha = alpha * 0.35
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(0, s * 0.86, s * 0.78, s * 0.16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 本体(暗いメタル)+ 縁のグロー
  const body = ctx.createRadialGradient(-s * 0.35, -s * 0.45, s * 0.1, 0, 0, s * 1.1)
  body.addColorStop(0, '#34445a')
  body.addColorStop(0.55, '#19222f')
  body.addColorStop(1, '#0e151f')
  ctx.beginPath()
  ctx.arc(0, 0, s, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.shadowColor = withAlpha(accent, aura ? 0.9 : 0.45)
  ctx.shadowBlur = s * (aura ? 0.5 : 0.22)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0

  // 縁(上が明るく下が暗い金属リング)
  const rim = ctx.createLinearGradient(0, -s, 0, s)
  rim.addColorStop(0, shade(accent, 0.55))
  rim.addColorStop(0.5, accent)
  rim.addColorStop(1, shade(accent, -0.45))
  ctx.lineWidth = Math.max(2, s * 0.085)
  ctx.strokeStyle = rim
  ctx.beginPath()
  ctx.arc(0, 0, s - ctx.lineWidth / 2, 0, Math.PI * 2)
  ctx.stroke()

  // 内側の細いリング(刻印)
  ctx.lineWidth = Math.max(1, s * 0.022)
  ctx.strokeStyle = withAlpha(accent, 0.38)
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2)
  ctx.stroke()

  // 左上のベベルハイライト
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = Math.max(1.2, s * 0.03)
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.9, Math.PI * 1.08, Math.PI * 1.55)
  ctx.stroke()
  ctx.restore()

  // デーヴァナーガリー文字: 内側リングに収まるよう、長い結合文字は縮小する
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let size = s * 0.82
  ctx.font = `700 ${size}px ${FONT}`
  const w = ctx.measureText(item.glyph).width
  const maxW = s * 1.18
  if (w > maxW) {
    size *= maxW / w
    ctx.font = `700 ${size}px ${FONT}`
  }
  const glyphColor = shade(accent, 0.7)
  ctx.shadowColor = withAlpha(accent, 0.85)
  ctx.shadowBlur = s * 0.2
  ctx.fillStyle = glyphColor
  ctx.fillText(item.glyph, 0, -s * 0.1)
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0

  // ローマ字(IAST)
  ctx.font = `700 ${Math.max(8, s * 0.24)}px "Noto Sans JP", system-ui, sans-serif`
  ctx.fillStyle = shade(accent, 0.4)
  ctx.fillText(item.label, 0, s * 0.56)

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
    b.medal = { level, born: performance.now(), pop: 0, merging: false }
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
      const ja = a.medal
      const jb = b.medal
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
    ball.medal.pop = 1
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

    // ラインを超えたまま一定時間たまっていたら終了(落としたてのメダルは猶予)
    const now = performance.now()
    let over = false
    for (const b of Composite.allBodies(this.engine.world)) {
      if (b.isStatic || !b.medal) continue
      const j = b.medal
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

    // フィールド(暗いパネル+うっすらグリッド)
    ctx.save()
    ctx.fillStyle = '#0f1824'
    roundRect(ctx, 6, 30, W - 12, H - 36, 22)
    ctx.fill()
    ctx.save()
    roundRect(ctx, 6, 30, W - 12, H - 36, 22)
    ctx.clip()
    ctx.strokeStyle = 'rgba(140, 170, 210, 0.06)'
    ctx.lineWidth = 1
    for (let gx = 6; gx < W; gx += 42) {
      ctx.beginPath()
      ctx.moveTo(gx, 30)
      ctx.lineTo(gx, H)
      ctx.stroke()
    }
    for (let gy = 30; gy < H; gy += 42) {
      ctx.beginPath()
      ctx.moveTo(6, gy)
      ctx.lineTo(W - 6, gy)
      ctx.stroke()
    }
    ctx.restore()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(140, 170, 210, 0.35)'
    roundRect(ctx, 6, 30, W - 12, H - 36, 22)
    ctx.stroke()
    ctx.restore()

    // ゲームオーバーライン(はみ出していると赤く点滅)
    const danger = Math.min(1, this.overTime / OVER_MS)
    ctx.save()
    ctx.setLineDash([10, 8])
    ctx.lineWidth = 2 + danger * 2
    ctx.strokeStyle = `rgba(230, 80, 70, ${0.4 + danger * 0.5 + Math.sin(t / 150) * 0.15 * danger})`
    ctx.beginPath()
    ctx.moveTo(18, LINE_Y)
    ctx.lineTo(W - 18, LINE_Y)
    ctx.stroke()
    ctx.restore()

    // 次に落とすメダルと狙い線
    if (!this.finished) {
      const next = this.chars[this.nextLevel]
      ctx.save()
      ctx.setLineDash([4, 10])
      ctx.strokeStyle = 'rgba(90, 200, 240, 0.55)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(this.aimX, SPAWN_Y + next.radius)
      ctx.lineTo(this.aimX, H - 20)
      ctx.stroke()
      ctx.restore()
      const bob = this.pointerDown ? 0 : Math.sin(t / 420) * 3
      drawMedal(ctx, this.aimX, SPAWN_Y + bob, next, { alpha: 0.96 })
    }

    for (const b of Composite.allBodies(this.engine.world)) {
      if (b.isStatic || !b.medal) continue
      const pop = popCurve(b.medal.pop)
      drawMedal(ctx, b.position.x, b.position.y, this.chars[b.medal.level], {
        scale: 1 + 0.2 * pop,
        squash: -0.05 * pop,
        aura: b.medal.level >= this.maxLevel,
      })
    }

    drawParticles(ctx, this.particles)
  }
}
