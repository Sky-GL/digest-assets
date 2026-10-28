// 夜間チェック: データの整合性と README の記述がコードと食い違っていないかを確認する。
// 依存なし(Node 標準のみ)。問題があれば終了コード 1。使い方: npm run check
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const errors = []
const ng = (msg) => errors.push(msg)

const chars = JSON.parse(read('src/data/devanagari-data.json')).characters
const words = JSON.parse(read('src/data/words.json')).words
const ids = new Set(chars.map((c) => c.id))

const dupes = (list) => list.filter((x, i) => list.indexOf(x) !== i)

// 1. 文字データ
for (const id of dupes(chars.map((c) => c.id))) ng(`文字IDが重複: ${id}`)
for (const c of chars) {
  for (const key of ['devanagari', 'iast', 'kana', 'step']) {
    if (c[key] === undefined || c[key] === '') ng(`文字 ${c.id} に ${key} が無い`)
  }
}

// 2. 単語データ: 構成文字がすべて存在するか
for (const id of dupes(words.map((w) => w.id))) ng(`単語IDが重複: ${id}`)
for (const w of words) {
  for (const cid of w.chars) if (!ids.has(cid)) ng(`単語 ${w.id} の構成文字 ${cid} が文字データに無い`)
}

// 3. ペア・ポップのステージが参照する文字IDが存在するか(JS を実行せず文字列から抽出)
const pairsSrc = read('src/data/pairs.js')
for (const [, id] of pairsSrc.matchAll(/\b[ab]:\s*'([\w]+)'/g)) {
  if (!ids.has(id)) ng(`pairs.js の ${id} が文字データに無い`)
}
const popSrc = read('src/data/popStages.js')
for (const [, list] of popSrc.matchAll(/(?:fromIds\(|syllables\('\w+',\s*)\[([^\]]*)\]/g)) {
  const stageIds = [...list.matchAll(/'([\w]+)'/g)].map((m) => m[1])
  if (stageIds.length !== 5) ng(`popStages.js のステージが5文字でない: ${stageIds.join(',')}`)
  for (const id of stageIds) if (!ids.has(id)) ng(`popStages.js の ${id} が文字データに無い`)
}

// 4. README の記述とデータの一致(総文字数・Step別の文字数)
const readme = read('README.md')
const total = readme.match(/全(\d+)文字/)
if (total && Number(total[1]) !== chars.length) {
  ng(`README は全${total[1]}文字だが、データは${chars.length}文字`)
}
for (const [, step, count] of readme.matchAll(/^\|\s*(\d+)\s*\|.*\|\s*(\d+)\s*\|\s*$/gm)) {
  const actual = chars.filter((c) => c.step === Number(step)).length
  if (actual !== Number(count)) ng(`README の Step${step} は${count}文字だが、データは${actual}文字`)
}

if (errors.length) {
  console.log(`NG: ${errors.length}件`)
  for (const e of errors) console.log(`- ${e}`)
  process.exit(1)
}
console.log(`OK: 文字${chars.length} / 単語${words.length} / 参照・README とも整合`)
