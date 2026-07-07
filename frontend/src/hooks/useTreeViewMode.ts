import { useEffect, useState } from 'react'

const STORAGE_KEY = 'learnmap.tree.viewMode'

export type TreeViewMode = 'list' | 'chart'

function loadInitial(): TreeViewMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'chart' ? 'chart' : 'list'
  } catch {
    return 'list'
  }
}

/** Persists the Learning page's list-vs-org-chart view preference across reloads. */
export function useTreeViewMode() {
  const [mode, setMode] = useState<TreeViewMode>(loadInitial)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  return [mode, setMode] as const
}
