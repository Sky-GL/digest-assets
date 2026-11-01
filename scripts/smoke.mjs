// 自己検証ループ用スモークテスト: ビルド成果物を headless Chromium で実際に操作し、
// 全画面を巡回して「コンソールエラー・例外・画面崩壊」が無いことを確認する。
// 人間が目視で確認しなくても、エージェント自身が変更後に回して合否を判断できる。
//
// 使い方: npm run build && npm run smoke
// 環境変数: CHROMIUM_PATH (任意。Playwright 同梱以外のブラウザを使う場合)
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 4173
const URL = `http://localhost:${PORT}/`

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const stop = () => server.kill()
process.on('exit', stop)

const waitServer = async () => {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(URL)).ok) return
    } catch {
      /* 起動待ち */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('preview サーバが起動しなかった(先に npm run build を実行すること)')
}

const errors = []
const results = []
const check = async (name, fn) => {
  const before = errors.length
  try {
    await fn()
    const added = errors.slice(before)
    if (added.length) throw new Error(`コンソール/ページエラー: ${added.join(' | ')}`)
    results.push({ name, ok: true })
  } catch (e) {
    results.push({ name, ok: false, msg: e.message.split('\n')[0] })
  }
}

try {
  await waitServer()
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    // 音声合成・Service Worker はヘッドレスでは使えないので無視
    if (m.type() === 'error' && !/speech|service ?worker|favicon|\.mp3|Failed to load resource/i.test(m.text())) {
      errors.push(`console.error: ${m.text()}`)
    }
  })

  const home = async () => {
    await page.locator('button.logo').click()
    await page.locator('.stepmap').waitFor()
  }

  await check('マップが表示される(12 Step)', async () => {
    await page.goto(URL)
    await page.locator('.stepmap').waitFor()
    const n = await page.locator('.step-card').count()
    if (n !== 12) throw new Error(`step-card が ${n} 枚(期待 12)`)
  })

  await check('Step1 フラッシュカードが開く', async () => {
    await page.locator('.step-card').first().click()
    await page.locator('.screen').first().waitFor()
    await home()
  })

  // マップ上のモードカード: [クラス名, 遷移後に出るはずの要素]
  for (const [cls, label] of [
    ['words', '単語モード'],
    ['challenge', '4択チャレンジ'],
    ['memory', '神経衰弱'],
  ]) {
    await check(`${label} が開く`, async () => {
      await page.locator(`.mode-card.${cls}`).click()
      await page.locator('.screen').first().waitFor()
      await home()
    })
  }

  await check('ポップ: タイトル→PLAY→キャンバス描画', async () => {
    await page.locator('.mode-card.pop').click()
    await page.getByText('▶ PLAY').click()
    const canvas = page.locator('canvas.pop-canvas')
    await canvas.waitFor()
    await page.waitForTimeout(800) // 物理エンジンを数フレーム回す
    const box = await canvas.boundingBox()
    if (!box || box.width < 100 || box.height < 100) throw new Error('キャンバスが小さすぎる/描画されていない')
  })

  await browser.close()
} finally {
  stop()
}

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n      ${r.msg}`}`)
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
