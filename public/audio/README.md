# フォールバック用音声ファイル

Web Speech API が hi-IN 音声を持たない環境(多くの Windows/Linux ブラウザ)向けのフォールバックです。

`src/lib/speech.js` は次の順で再生を試みます。

1. `speechSynthesis` に `hi-*` の音声がある → TTS で再生
2. なければ `devanagari-data.json` の `audioUrl`(= `/audio/<id>.mp3`)を再生
3. どちらも失敗 → ボタンが「音声なし」表示になる

## 配置方法

`src/data/devanagari-data.json` の各 `id` に対応する mp3 をこのディレクトリに置いてください。

```
public/audio/a.mp3, i.mp3, u.mp3, ... ka.mp3, kha.mp3, ... m_aa.mp3, ... shra.mp3
```

全 62 ファイル。ファイル名一覧は次のコマンドで出力できます。

```bash
node -e "require('./src/data/devanagari-data.json').characters.forEach(c=>console.log(c.audioUrl))"
```

mp3 が無くてもアプリは動作します(TTS 対応環境では問題なし)。
