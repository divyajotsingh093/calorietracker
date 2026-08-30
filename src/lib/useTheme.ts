import { useCallback, useEffect, useState } from 'react'
import {
  applyTheme,
  persistAccent,
  persistMode,
  readAccent,
  readMode,
  resolveMode,
  type Accent,
  type ThemeMode,
} from '@/lib/theme'

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(readMode)
  const [accent, setAccentState] = useState<Accent>(readAccent)

  useEffect(() => {
    applyTheme(mode, accent)
  }, [mode, accent])

  // Follow the OS while the mode is "system".
  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system', accent)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode, accent])

  const setMode = useCallback((next: ThemeMode) => {
    persistMode(next)
    setModeState(next)
  }, [])

  const setAccent = useCallback((next: Accent) => {
    persistAccent(next)
    setAccentState(next)
  }, [])

  return { mode, accent, setMode, setAccent, resolved: resolveMode(mode) }
}
