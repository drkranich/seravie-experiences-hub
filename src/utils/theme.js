const DEFAULT_THEME = {
  primary: '#000000',
  secondary: '#ffffff',
  accent: '#3b82f6',
  background: '#ffffff',
  text: '#000000',
}

export function getTheme() {
  const saved = localStorage.getItem('seravie_theme')
  return saved ? JSON.parse(saved) : DEFAULT_THEME
}

export function setTheme(theme) {
  localStorage.setItem('seravie_theme', JSON.stringify(theme))
  applyTheme(theme)
}

export function applyTheme(theme) {
  const root = document.documentElement
  root.style.setProperty('--color-primary', theme.primary)
  root.style.setProperty('--color-secondary', theme.secondary)
  root.style.setProperty('--color-accent', theme.accent)
  root.style.setProperty('--color-background', theme.background)
  root.style.setProperty('--color-text', theme.text)
}

export function resetTheme() {
  localStorage.removeItem('seravie_theme')
  applyTheme(DEFAULT_THEME)
}
