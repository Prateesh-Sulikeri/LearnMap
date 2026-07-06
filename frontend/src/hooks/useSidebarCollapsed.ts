import { useEffect, useState } from 'react'

const STORAGE_KEY = 'learnmap.sidebar.collapsed'

function loadInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/** Persists the desktop/tablet sidebar's collapsed (icon-only) state across reloads. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(loadInitial)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed))
  }, [collapsed])

  return [collapsed, setCollapsed] as const
}
