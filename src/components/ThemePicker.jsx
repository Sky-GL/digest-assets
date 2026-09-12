import { useEffect, useRef, useState } from 'react'
import { THEMES, loadTheme, applyTheme } from '../lib/theme'

export default function ThemePicker() {
  const [theme, setTheme] = useState(loadTheme)
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // パネルの外側をタップしたら閉じる
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div className="theme-picker" ref={boxRef}>
      <button className="chip ghost" onClick={() => setOpen((v) => !v)} title="配色を変える" aria-label="配色を変える">
        🎨
      </button>
      {open && (
        <div className="theme-menu">
          <p className="tm-title">配色</p>
          {THEMES.map((t) => (
            <button
              key={t.key}
              className={`theme-opt ${theme === t.key ? 'on' : ''}`}
              onClick={() => {
                setTheme(t.key)
                setOpen(false)
              }}
            >
              <span className="tm-swatch">
                {t.swatch.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              <span className="tm-text">
                <strong>{t.label}</strong>
                <small>{t.note}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
