# Devanagari Quest — ヒンディー語(デーヴァナーガリー文字)学習アプリ

母音 → 子音(調音位置が喉の奥から唇へ移る伝統配列)→ マートラ → 結合文字、の順に
Step1〜13 を進めていくゲーム感覚のフラッシュカード学習アプリ。React + Vite、バックエンド不要。

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ を出力
```

## 学習カリキュラム(全62文字)

| Step | 内容 | 文字数 |
| --- | --- | --- |
| 1 | 母音(短) अ इ उ | 3 |
| 2 | 母音(長) आ ई ऊ | 3 |
| 3 | 母音(複合) ए ऐ ओ औ | 4 |
| 4 | 特殊母音記号 ऋ अं अः | 3 |
| 5 | 子音① 軟口蓋音 क〜ङ | 5 |
| 6 | 子音② 硬口蓋音 च〜ञ | 5 |
| 7 | 子音③ そり舌音 ट〜ण | 5 |
| 8 | 子音④ 歯音 त〜न | 5 |
| 9 | 子音⑤ 唇音 प〜म | 5 |
| 10 | 半母音 य र ल व | 4 |
| 11 | 摩擦音 श ष स ह | 4 |
| 12 | **マートラ(母音記号)** ा ि ी ु ू ृ े ै ो ौ ं ः | 12 |
| 13 | 頻出結合文字 क्ष त्र ज्ञ श्र | 4 |

子音は5行すべてが「無声無気 → 無声有気 → 有声無気 → 有声有気 → 鼻音」の同じ並び。
1行覚えれば残り4行は調音位置が移動するだけ、という設計思想でStepを組んでいる。

## 機能

- **フラッシュカード** — 大きなデーヴァナーガリー文字 / IAST / IPA / カナ近似 / 解説。タップで裏返し、`←` `→` で移動、`Space` で反転。カード切替時に自動発音。
- **Stepアンロック** — Stepクイズで正答率80%以上を取ると次のStepが開く。正答率に応じて★1〜3。
- **双方向4択クイズ** — 「文字 → 発音」と「発音 → 文字」を交互に出題。ダミー選択肢は同じ調音位置グループから優先的に選ぶため、そり舌音 ट と歯音 त のような紛らわしい対比が自然に練習できる。
- **マートラ実験室(Step12)** — 子音 × マートラを自由に組み合わせて音節を合成。選んだ子音の全12音節を一覧再生できる。クイズも「क + ा = ?」形式の組み合わせ問題を6割の比率で重点出題。
- **復習モード** — 誤答回数と最終学習日時から優先度を計算する簡易スペースドリペティション。間違えた文字ほど、久しく見ていない文字ほど先に出る。
- **進捗保存** — localStorage(`devanagari-quest-v1`)に Lv/XP・Stepクリア状況・文字ごとの正誤回数・連続学習日数・最大コンボを保存。

## 発音再生

`src/lib/speech.js` が次の順で再生を試みる。

1. `speechSynthesis` に `hi-*` の音声がある → Web Speech API(`lang="hi-IN"`, `rate=0.75`)で再生
2. なければ `/audio/<id>.mp3` を再生(`devanagari-data.json` の `audioUrl`)
3. どちらも失敗 → ボタンが「🔇 音声なし」表示に変わる

mp3 は同梱していない。安定させたい場合は `public/audio/README.md` の手順で 62 ファイルを配置する。
mp3 が無くても、hi-IN 音声を持つ環境(macOS / iOS / Android / Chrome の多く)では問題なく動作する。

## データ構造

`src/data/devanagari-data.json` の 1 エントリ:

```json
{
  "id": "ka",
  "devanagari": "क",
  "iast": "ka",
  "ipa": "/kə/",
  "kana": "カ",
  "group": "velar",
  "step": 5,
  "speak": "क",
  "series": "無声無気",
  "note": "日本語の「カ」。息を強く出さない。",
  "audioUrl": "/audio/ka.mp3"
}
```

マートラは追加で `display`(`◌ा` のような点線円つき表示)、`matraFor`、`example` / `exampleRead`、
`position`(付く位置)、`keepInherent` を持つ。
`keepInherent` はアヌスヴァーラ ं とヴィサルガ ः に付き、これらが固有母音 a を置き換えない
(`क + ं = कं` は `kṃ` ではなく `kaṃ`)ことを表す。音節合成は `syllable()`(`src/data/steps.js`)で行う。

## 構成

```
src/
├── data/devanagari-data.json   全62文字のデータ
├── data/steps.js               Step メタ情報・検索ヘルパー・音節合成
├── lib/speech.js               発音(TTS + mp3フォールバック)
├── lib/quiz.js                 出題生成(双方向4択・マートラ組み合わせ)
├── lib/srs.js                  復習優先度スコア
├── lib/storage.js              localStorage 入出力・連続日数
├── hooks/useProgress.js        進捗ステート(XP/Lv/アンロック判定)
└── components/                 HUD / StepMap / Flashcards / Quiz / MatraLab / SpeakButton
```

## デプロイ

`vercel.json` を同梱。Vercel にインポートすればそのままビルドされる(SPA なので全パスを `/index.html` に rewrite)。
