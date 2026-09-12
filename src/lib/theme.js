const KEY = 'devanagari-quest-theme'

export const THEMES = [
  {
    key: 'paper',
    label: 'サフラン',
    note: '生成りの紙に辰砂と藍。インドの顔料から',
    swatch: ['#fbf4e6', '#c8442a', '#1f548c'],
  },
  {
    key: 'indigo',
    label: '藍',
    note: '夜の藍色に金。落ち着いたダーク',
    swatch: ['#0a1728', '#e9b949', '#2fb3a0'],
  },
  {
    key: 'sumi',
    label: '墨と朱',
    note: '墨色に朱の一点。文字が主役',
    swatch: ['#121211', '#e2442f', '#c9a227'],
  },
  {
    key: 'night',
    label: 'ナイト',
    note: '以前の紫。ネオン寄り',
    swatch: ['#150e28', '#fbbf24', '#c084fc'],
  },
]

export const DEFAULT_THEME = 'paper'

export const loadTheme = () => {
  try {
    const v = localStorage.getItem(KEY)
    return THEMES.some((t) => t.key === v) ? v : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/** テーマを <html data-theme> に反映し、アドレスバーの色(theme-color)も合わせる */
export const applyTheme = (key) => {
  const theme = THEMES.find((t) => t.key === key) || THEMES[0]
  document.documentElement.dataset.theme = theme.key
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme.swatch[0])
  try {
    localStorage.setItem(KEY, theme.key)
  } catch {
    /* 保存不可でも表示は切り替わる */
  }
}
