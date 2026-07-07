import { createContext, use, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'learnmap.theme'
type Theme = 'light' | 'dark'

function loadInitial(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // ignore — fall through to system preference
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore — theme just won't persist across reloads
  }
}

interface ThemeContextValue {
  theme: Theme
  /** Toggles the theme. Pass the triggering click's coordinates for a circular reveal centered there; omit for a plain switch (e.g. no origin available). */
  toggleTheme: (origin?: { x: number; y: number }) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// One shared instance mounted at the app root (not per-component) so every
// route — including the login/register/public-profile pages that render
// outside AppLayout — gets the `.dark` class applied from a single source of
// truth, and toggling it anywhere (the sidebar's user menu) is reflected
// everywhere instantly.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(loadInitial)

  // Keeps the DOM class in sync with React state generally (covers the
  // initial mount); toggleTheme below also applies it synchronously itself
  // when animating, since the View Transition API needs the DOM already
  // updated by the time its callback returns, not on a later effect tick.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = (origin?: { x: number; y: number }) => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!document.startViewTransition || reduceMotion) {
      setTheme(next)
      return
    }

    const x = origin?.x ?? window.innerWidth / 2
    const y = origin?.y ?? window.innerHeight / 2
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

    const transition = document.startViewTransition(() => {
      setTheme(next)
      applyTheme(next)
    })

    void transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
        { duration: 600, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
      )
    })
  }

  return <ThemeContext value={{ theme, toggleTheme }}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const ctx = use(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
