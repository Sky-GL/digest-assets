import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { loadTheme, applyTheme } from './lib/theme'

applyTheme(loadTheme()) // 描画前に配色を当ててチラつきを防ぐ

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Service Workerを登録する。
// これが無いとChromeがPWAと認識せず、ホーム画面に追加しても
// manifestのアイコンではなく自動生成のタイルになってしまう。
// 開発中(vite dev)は邪魔なので本番ビルドのときだけ登録する。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // スコープをサイト全体にしたいので絶対パスで登録する
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 登録できなくてもアプリ自体は動く */
    })
  })
}
