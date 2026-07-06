import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'learnmap.tree.collapsed'

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

/** Persists which tree nodes are collapsed to localStorage — design doc §14: "Collapsed nodes remember state." */
export function useCollapsedState() {
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]))
  }, [collapsed])

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const isCollapsed = useCallback((id: string) => collapsed.has(id), [collapsed])

  return { isCollapsed, toggle }
}
