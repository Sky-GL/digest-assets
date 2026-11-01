# Feature Map(エージェント向け)

曖昧な不具合報告(「ポップで〜がおかしい」など)から、対象機能に自力で到達して再現・検証するための地図。
画面遷移は `src/App.jsx` の `view.name`(状態遷移のみ・URL ルーティングなし)。

## 画面一覧

| 機能 | view.name | 到達方法(Playwright) | 実装 | 到達後に出る目印 |
| --- | --- | --- | --- | --- |
| 学習マップ | `map` | 初期表示 / `button.logo` | `components/StepMap.jsx` | `.stepmap`, `.step-card` ×12 |
| フラッシュカード+重ね比較 | `cards` | `.step-card` をクリック(n番目=Step n) | `Flashcards.jsx`, `GlyphDiff.jsx` | `.screen` |
| Stepクイズ | `quiz` | フラッシュカード末尾の CTA | `Quiz.jsx`, `lib/quiz.js` | `.quiz-head`, `.quiz-bar` |
| マートラ実験室 | `lab` | Step11 のカード経由 | `MatraLab.jsx` | — |
| 復習モード | `review` | `.review-banner .btn.primary`(学習済み文字が1つ以上のとき有効) | `Quiz.jsx` | — |
| 単語モード | `words` | `.mode-card.words` | `WordMode.jsx`, `data/words.*` | `.word-card` |
| 4択チャレンジ | `challenge` | `.mode-card.challenge` | `Challenge.jsx` | — |
| 神経衰弱 | `memory` | `.mode-card.memory` | `MemoryGame.jsx` | — |
| ポップ | `pop` | `.mode-card.pop` → タイトルで `▶ PLAY` | `PopGame.jsx`, `lib/popEngine.js` | `canvas.pop-canvas` |

ポップのタイトル画面: モード選択(`📖 読みモード` 既定 / `🫧 ふつう`)→ステージ選択(1〜12・ロック無し)→`▶ PLAY`。ヘルプは `aria-label="あそびかた"`。

## 状態の入口(再現を速くする)

localStorage を直接書けば、操作を省いて任意の進捗状態から検証できる。

| キー | 中身 | 管理 |
| --- | --- | --- |
| `devanagari-quest-v1` | 進捗(xp / streak / chars / steps / bestChallenge) | `lib/storage.js` |
| `devanagari-pop-v1` | ポップの記録(best / cleared / コンボ / exp) | `lib/popStore.js` |
| `devanagari-quest-theme` | テーマ | `lib/theme.js` |

```js
// 例: 学習済み文字がある状態で復習モードを検証する
await page.addInitScript(() => localStorage.setItem('devanagari-quest-v1', JSON.stringify({ /* storage.js の emptyProgress() 形 */ })))
```

## データの所在(「ここを直せば足りる」)

| 変えたいこと | 場所 |
| --- | --- |
| 文字・読み・Step割当 | `src/data/devanagari-data.json` |
| Step の見出し・色・ヒント | `src/data/steps.js` |
| 重ね比較ペア | `src/data/pairs.js`(`a`=先に習う側, `b`=後で習う側) |
| 単語 | `src/data/words.json`(`chars` は文字ID) |
| ポップのステージ構成 | `src/data/popStages.js`(5文字固定) |
| ポップの物理・合体規則 | `src/lib/popEngine.js` / 最終形: `popFinal.js` / 演出: `popFx.js` |

## 自己検証の手順

1. `npm run verify` で lint・データ・ビルド・全画面スモークを一括確認。
2. 画面固有の挙動は `scripts/smoke.mjs` の `check()` をひな形に、対象画面へ遷移して DOM / canvas / localStorage を直接計測する(ヘッドレスでは音声合成と Service Worker は動かない前提)。
3. 新しい画面を追加したら、この表と `scripts/smoke.mjs` の両方に1行足す。
