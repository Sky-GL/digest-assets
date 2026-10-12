import Matter from 'matter-js'
import { shade, withAlpha } from '../data/popStages'
import { playPopDrop, playPopMerge, playPopFinish, playPopSpecial, unlockAudio } from './sfx'
import { SPECIALS, drawSpecial } from './popSpecials'
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
const VANISH_MS = 1800 // 最終形が完成してから消えるまで
const VANISH_BONUS = 300
const CROWN_BONUS = 500
const SPECIAL_MIN_DROPS = 5 // 最初の数手は特別メダルを出さない
const SPECIAL_PITY = 14 // これだけ出なかったら必ず出す
const STEP = 1000 / 60
const FONT = '"Noto Sans Devanagari", "Nirmala UI", "Kohinoor Devanagari", sans-serif'

// ---------- パーティクル(火花・破片) ----------
const SPARK_COLORS = ['#f2c94c', '#e0902f', '#5aa0d6', '#e8eef7', '#3bb3a3']

const burst = (list, x, y, power = 1, colors = SPARK_COLORS) => {
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
      color: colors[Math.floor(Math.random() * colors.length)],
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
 * 文字メダル: レベル色に染めた暗い円盤+太いリング+ほぼ白の大きな文字。
 * 視認性のため、(1)文字は白に近い色+暗い縁取りで背景から浮かせる (2)ボディをレベル色で染めて
 * 隣のレベルと見分けやすくする (3)小さいメダルはローマ字を省いて文字を大きく描く。
 * 最終形(aura)は金の光輪をまとう。
 */
export const drawMedal = (ctx, x, y, item, { scale = 1, alpha = 1, squash = 0, aura = false } = {}) => {
  const s = item.radius * scale
  const accent = item.base
  const showLabel = item.radius >= 30 // 小さいメダルではローマ字が潰れるので文字を優先する
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.scale(1 + squash, 1 - squash)

  // 接地影
  ctx.save()
  ctx.globalAlpha = alpha * 0.4
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(0, s * 0.88, s * 0.78, s * 0.15, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 本体: レベル色で染めた暗いメタル(色でレベルを判別できるように)+ 外側のグロー
  const body = ctx.createRadialGradient(-s * 0.3, -s * 0.4, s * 0.05, 0, 0, s * 1.05)
  body.addColorStop(0, shade(accent, -0.35))
  body.addColorStop(0.6, shade(accent, -0.68))
  body.addColorStop(1, shade(accent, -0.85))
  ctx.beginPath()
  ctx.arc(0, 0, s, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.shadowColor = withAlpha(accent, aura ? 0.95 : 0.55)
  ctx.shadowBlur = s * (aura ? 0.55 : 0.25)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0

  // 太いリング(上が明るく下が暗い金属)。盤面の暗い背景との境界をくっきりさせる
  const rw = Math.max(3, s * 0.12)
  const rim = ctx.createLinearGradient(0, -s, 0, s)
  rim.addColorStop(0, shade(accent, 0.6))
  rim.addColorStop(0.5, accent)
  rim.addColorStop(1, shade(accent, -0.25))
  ctx.lineWidth = rw
  ctx.strokeStyle = rim
  ctx.beginPath()
  ctx.arc(0, 0, s - rw / 2, 0, Math.PI * 2)
  ctx.stroke()

  // 左上のベベルハイライト
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = Math.max(1.2, s * 0.035)
  ctx.beginPath()
  ctx.arc(0, 0, s - rw * 1.4, Math.PI * 1.1, Math.PI * 1.5)
  ctx.stroke()
  ctx.restore()

  // デーヴァナーガリー文字: 大きく描き、リングの内側に収まらない長い結合文字だけ縮小する
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const inner = s - rw
  let size = inner * (showLabel ? 1.0 : 1.12)
  ctx.font = `700 ${size}px ${FONT}`
  const w = ctx.measureText(item.glyph).width
  const maxW = inner * 1.55
  if (w > maxW) {
    size *= maxW / w
    ctx.font = `700 ${size}px ${FONT}`
  }
  const gy = showLabel ? -inner * 0.14 : 0
  // 暗い縁取り → 発光 → ほぼ白の文字、の順で重ねて背景から浮かせる
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(3, size * 0.14)
  ctx.strokeStyle = 'rgba(5, 9, 16, 0.9)'
  ctx.strokeText(item.glyph, 0, gy)
  ctx.shadowColor = withAlpha(accent, 0.9)
  ctx.shadowBlur = s * 0.16
  ctx.fillStyle = '#ffffff'
  ctx.fillText(item.glyph, 0, gy)
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0

  // ローマ字(IAST): 暗い縁取り付きの明るい色で、十分な大きさにする
  if (showLabel) {
    const ls = Math.max(11, inner * 0.3)
    ctx.font = `800 ${ls}px "Noto Sans JP", system-ui, sans-serif`
    ctx.lineWidth = Math.max(3, ls * 0.28)
    ctx.strokeStyle = 'rgba(5, 9, 16, 0.9)'
    ctx.strokeText(item.label, 0, inner * 0.62)
    ctx.fillStyle = shade(accent, 0.65)
    ctx.fillText(item.label, 0, inner * 0.62)
  }

  ctx.restore()
}

const popCurve = (v) => (v <= 0 ? 0 : Math.sin(v * Math.PI * 0.9))

// ---------- ゲーム本体 ----------
export class PopEngine {
  /**
   * @param stage  POP_STAGES の1要素
   * @param cb     { onScore, onNext, onFirstInteract, onUnlock, onMerge, onSpecial, onStageClear, onFinish }
   */
  constructor(stage, cb) {
    this.cb = cb
    this.chars = stage.chars
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
    this.bag = [] // 出す順にシャッフルした文字の袋。空になったら詰め直す
    this.lastSpawn = -1
    this.drops = 0
    this.sinceSpecial = 0
    this.next = this.rollNext()
  }

  get maxLevel() {
    return this.chars.length - 1
  }

  /**
   * 次に降らせる文字を決める。学習のため、ステージの全文字を「シャッフルした袋」から1周ずつ出す。
   * 1周の間に各文字がちょうど1回ずつ出るので偏らない(最終形は合体でしか出ない)。
   */
  rollBag() {
    if (this.bag.length === 0) {
      const bag = Array.from({ length: this.maxLevel }, (_, i) => i)
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[bag[i], bag[j]] = [bag[j], bag[i]]
      }
      // 袋の継ぎ目で同じ文字が続かないようにする(末尾から取り出す)
      if (bag.length > 1 && bag[bag.length - 1] === this.lastSpawn) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]]
      this.bag = bag
    }
    this.lastSpawn = this.bag.pop()
    return this.lastSpawn
  }

  /** 盤面の積み上がり具合(0=空〜1=ゲームオーバーライン) */
  fullness() {
    let top = H
    for (const b of Composite.allBodies(this.engine.world)) {
      if (!b.isStatic && b.medal) top = Math.min(top, b.position.y - this.radiusOf(b.medal))
    }
    return Math.max(0, Math.min(1, (H - top) / (H - LINE_Y)))
  }

  /**
   * 次に降らせるものを決める: { level } か { special }。
   * 特別メダルは積み上がるほど出やすく(詰まったときの救済)、一定回数出なければ必ず出る。
   */
  rollNext() {
    this.sinceSpecial += 1
    if (this.drops >= SPECIAL_MIN_DROPS) {
      const full = this.fullness()
      const chance = 0.04 + 0.3 * Math.max(0, full - 0.3)
      if (this.sinceSpecial >= SPECIAL_PITY || Math.random() < chance) {
        this.sinceSpecial = 0
        return { special: this.pickSpecial(full) }
      }
    }
    return { level: this.rollBag() }
  }

  // 虹が一番出やすく、詰まってくるほどダイヤ・クラウンの比重が上がる
  pickSpecial(full) {
    const w = { rainbow: 5, diamond: 3.5 * (1 + full), crown: 1.2 * (1 + 2 * full) }
    let r = Math.random() * (w.rainbow + w.diamond + w.crown)
    for (const k of ['rainbow', 'diamond', 'crown']) {
      if ((r -= w[k]) < 0) return k
    }
    return 'rainbow'
  }

  radiusOf(m) {
    return m.special ? SPECIALS[m.special].radius : this.chars[m.level].radius
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

    this.cb.onNext(this.next)
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
    this.bag = []
    this.lastSpawn = -1
    this.drops = 0
    this.sinceSpecial = 0
    this.next = this.rollNext()
    this.cb.onScore(0)
    this.cb.onNext(this.next)
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
    const r = this.radiusOf(this.next)
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

  makeSpecial(x, y, kind) {
    const b = Bodies.circle(x, y, SPECIALS[kind].radius, {
      restitution: 0.16,
      friction: 0.55,
      frictionStatic: 0.7,
      density: 0.0011,
      slop: 0.02,
    })
    b.medal = { level: -1, special: kind, born: performance.now(), pop: 0, merging: false }
    return b
  }

  drop() {
    const now = performance.now()
    if (now - this.lastDrop < DROP_COOLDOWN) return
    this.lastDrop = now
    const it = this.next
    if (it.special) {
      Composite.add(this.engine.world, this.makeSpecial(this.aimX, SPAWN_Y, it.special))
      playPopDrop()
    } else {
      Composite.add(this.engine.world, this.makeBall(this.aimX, SPAWN_Y, it.level))
      playPopDrop()
      speakText(this.chars[it.level].speak, { rate: 0.85, pitch: 1.2 })
    }
    this.drops += 1
    this.next = this.rollNext()
    this.cb.onNext(this.next)
  }

  onCollide = (ev) => {
    for (const pair of ev.pairs) {
      const a = pair.bodyA
      const b = pair.bodyB
      if (a.isStatic || b.isStatic) continue
      const ja = a.medal
      const jb = b.medal
      if (!ja || !jb || ja.merging || jb.merging) continue

      // 特別メダルは文字に触れたときだけ効果が出る(特別どうしは何も起きない)
      if (ja.special || jb.special) {
        if (ja.special && jb.special) continue
        const sp = ja.special ? a : b
        const target = ja.special ? b : a
        this.triggerSpecial(sp, target)
        continue
      }

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
    this.evolve(x, y, level)
  }

  /** (x,y) に level の文字を出す(合体・虹の共通処理)。最終形ならステージクリアで、少しして消える */
  evolve(x, y, level, colors) {
    const isMax = level >= this.maxLevel
    const ball = this.makeBall(x, y, level)
    ball.medal.pop = 1
    if (isMax) ball.medal.vanishAt = performance.now() + VANISH_MS
    Composite.add(this.engine.world, ball)

    playPopMerge(level, isMax)
    speakText(this.chars[level].speak, { rate: 0.8, pitch: isMax ? 1.6 : 1.3 })
    burst(this.particles, x, y, isMax ? 1.6 : 1, colors)

    this.score += (level + 1) * 10
    this.cb.onScore(this.score)
    this.cb.onUnlock(level)
    this.cb.onMerge(level)
    if (isMax) this.cb.onStageClear()
  }

  removeBody(b, colors) {
    b.medal.merging = true
    Composite.remove(this.engine.world, b)
    burst(this.particles, b.position.x, b.position.y, 0.9, colors)
  }

  /** 盤面の通常の文字(特別メダルは含まない) */
  letters() {
    return Composite.allBodies(this.engine.world).filter((b) => !b.isStatic && b.medal && !b.medal.special && !b.medal.merging)
  }

  triggerSpecial(spBody, target) {
    const kind = spBody.medal.special
    const def = SPECIALS[kind]
    const tl = target.medal.level
    const here = { x: target.position.x, y: target.position.y }

    if (kind === 'rainbow') {
      if (tl >= this.maxLevel) return // 完成した文字にはもう進化先がない
      spBody.medal.merging = true
      target.medal.merging = true
      Composite.remove(this.engine.world, spBody)
      Composite.remove(this.engine.world, target)
      playPopSpecial('rainbow')
      this.evolve(here.x, here.y, tl + 1, def.colors)
      return
    }

    // ダイヤ: 触れた文字と同じ文字を全部 / クラウン: 盤面の文字を全部
    const victims = kind === 'diamond' ? this.letters().filter((b) => b.medal.level === tl) : this.letters()
    spBody.medal.merging = true
    Composite.remove(this.engine.world, spBody)
    burst(this.particles, spBody.position.x, spBody.position.y, 1.4, def.colors)
    let points = kind === 'crown' ? CROWN_BONUS : 50
    for (const v of victims) {
      points += (v.medal.level + 1) * 10
      this.removeBody(v, def.colors)
    }
    playPopSpecial(kind)
    if (kind === 'diamond') speakText(this.chars[tl].speak, { rate: 0.8, pitch: 1.3 })
    this.score += points
    this.cb.onScore(this.score)
    this.cb.onSpecial({ kind, count: victims.length, level: tl, points })
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
      if (j.vanishAt && now >= j.vanishAt && !j.merging) {
        // 完成した最終形は、輝いてから消えてボーナスになる(盤面を塞ぎ続けないように)
        this.removeBody(b, SPECIALS.crown.colors)
        burst(this.particles, b.position.x, b.position.y, 1.6, SPECIALS.crown.colors)
        playPopSpecial('crown')
        this.score += VANISH_BONUS
        this.cb.onScore(this.score)
        this.cb.onSpecial({ kind: 'complete', count: 1, level: j.level, points: VANISH_BONUS })
        continue
      }
      if (now - j.born > 900 && b.position.y - this.radiusOf(j) < LINE_Y) over = true
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
    ctx.strokeStyle = 'rgba(140, 170, 210, 0.045)'
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
    ctx.strokeStyle = `rgba(255, 90, 80, ${0.6 + danger * 0.4})`
    ctx.beginPath()
    ctx.moveTo(18, LINE_Y)
    ctx.lineTo(W - 18, LINE_Y)
    ctx.stroke()
    ctx.restore()
    // ラインを越えて積もり始めたら、盤面の枠を赤く点滅させて危険を知らせる
    if (danger > 0) {
      ctx.save()
      ctx.lineWidth = 4
      ctx.strokeStyle = `rgba(255, 80, 70, ${0.3 + 0.5 * Math.abs(Math.sin(t / 110)) * danger})`
      roundRect(ctx, 6, 30, W - 12, H - 36, 22)
      ctx.stroke()
      ctx.restore()
    }

    // 次に落とすメダルと狙い線
    if (!this.finished) {
      const nextR = this.radiusOf(this.next)
      ctx.save()
      ctx.setLineDash([4, 10])
      ctx.strokeStyle = 'rgba(90, 210, 255, 0.75)'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(this.aimX, SPAWN_Y + nextR)
      ctx.lineTo(this.aimX, H - 20)
      ctx.stroke()
      ctx.restore()
      const bob = this.pointerDown ? 0 : Math.sin(t / 420) * 3
      if (this.next.special) drawSpecial(ctx, this.aimX, SPAWN_Y + bob, this.next.special, { alpha: 0.96, t })
      else drawMedal(ctx, this.aimX, SPAWN_Y + bob, this.chars[this.next.level], { alpha: 0.96 })
    }

    const now = performance.now()
    for (const b of Composite.allBodies(this.engine.world)) {
      if (b.isStatic || !b.medal) continue
      const m = b.medal
      const pop = popCurve(m.pop)
      if (m.special) {
        drawSpecial(ctx, b.position.x, b.position.y, m.special, { scale: 1 + 0.2 * pop, t })
        continue
      }
      // 完成した最終形は消える直前に点滅させる
      const left = m.vanishAt ? m.vanishAt - now : Infinity
      const alpha = left < 700 ? 0.55 + 0.45 * Math.abs(Math.sin(t / 45)) : 1
      drawMedal(ctx, b.position.x, b.position.y, this.chars[m.level], {
        scale: 1 + 0.2 * pop,
        squash: -0.05 * pop,
        aura: m.level >= this.maxLevel,
        alpha,
      })
    }

    drawParticles(ctx, this.particles)
  }
}
