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
