import { useEffect, useState } from 'react'

/**
 * Whether this deployment carries an OpenRouter key of its own.
 *
 * When it does, the app works in any browser with nothing to paste: requests go
 * to `/api/openrouter`, which holds the key server-side and forwards them. A
 * personal key entered in Settings always wins — that path talks to OpenRouter
 * directly and costs the deployment's owner nothing.
 *
 * The probe runs once per page load. Everywhere without the function — `vite
 * dev`, a static host, a fork deployed without the variable — it answers "no"
 * and the app falls back to its on-device engine.
 */
export const PROXY_URL = '/api/openrouter'

export interface ServerKey {
  configured: boolean
  needsCode: boolean
}

const NONE: ServerKey = { configured: false, needsCode: false }

let probe: Promise<ServerKey> | null = null

export function serverKey(): Promise<ServerKey> {
  if (!probe) {
    probe = fetch(PROXY_URL, { method: 'GET' })
      .then((r) => (r.ok ? (r.json() as Promise<ServerKey>) : NONE))
      .then((v) => ({ configured: Boolean(v?.configured), needsCode: Boolean(v?.needsCode) }))
      .catch(() => NONE)
  }
  return probe
}

/** Access code for a proxy that asks for one. Per browser, not per session. */
const CODE_KEY = 'nourish.accessCode'

export function readAccessCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeAccessCode(code: string) {
  try {
    if (code.trim()) localStorage.setItem(CODE_KEY, code.trim())
    else localStorage.removeItem(CODE_KEY)
  } catch {
    // a browser with storage blocked simply asks again next time
  }
}

/** React binding for the probe: one request per page load, shared by every view. */
export function useServerKey(): ServerKey {
  const [state, setState] = useState<ServerKey>(NONE)
  useEffect(() => {
    let live = true
    void serverKey().then((v) => {
      if (live) setState(v)
    })
    return () => {
      live = false
    }
  }, [])
  return state
}
