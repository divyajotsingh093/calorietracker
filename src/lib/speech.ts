import { useCallback, useEffect, useRef, useState } from 'react'

/* The Web Speech API is still vendor-prefixed and missing from lib.dom, so the
   shapes this file uses are declared here rather than pulled from a package. */
interface SpeechAlternative {
  transcript: string
}
interface SpeechResult {
  0: SpeechAlternative
  isFinal: boolean
  length: number
}
interface SpeechResultList {
  length: number
  [index: number]: SpeechResult
}
interface SpeechEvent extends Event {
  resultIndex: number
  results: SpeechResultList
}
interface Recognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechEvent) => void) | null
  onerror: ((e: Event & { error?: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface Listener {
  supported: boolean
  listening: boolean
  /** what has been heard so far this utterance, final + interim */
  heard: string
  error: string | null
  start: () => void
  stop: () => void
}

/**
 * Dictation into the prompt box. `onFinal` fires once per utterance with the
 * settled transcript; `heard` streams the interim text so the HUD can show
 * words arriving rather than a dead microphone icon.
 */
export function useListener(onFinal: (text: string) => void): Listener {
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<Recognition | null>(null)
  const finalRef = useRef(onFinal)
  useEffect(() => {
    finalRef.current = onFinal
  }, [onFinal])

  const supported = typeof window !== 'undefined' && Boolean(recognitionCtor())

  const stop = useCallback(() => {
    ref.current?.stop()
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor) return
    ref.current?.abort()
    const rec = new Ctor()
    rec.lang = navigator.language || 'en-US'
    rec.continuous = false
    rec.interimResults = true
    let settled = ''

    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) settled += r[0].transcript
        else interim += r[0].transcript
      }
      setHeard((settled + interim).trim())
    }
    rec.onerror = (e) => {
      setError(
        e.error === 'not-allowed'
          ? 'Microphone permission was denied.'
          : e.error === 'no-speech'
            ? null
            : 'The microphone stopped unexpectedly.',
      )
      setListening(false)
    }
    rec.onend = () => {
      setListening(false)
      const text = settled.trim()
      setHeard('')
      if (text) finalRef.current(text)
    }

    ref.current = rec
    setError(null)
    setHeard('')
    setListening(true)
    try {
      rec.start()
    } catch {
      setListening(false)
    }
  }, [])

  useEffect(() => () => ref.current?.abort(), [])

  return { supported, listening, heard, error, start, stop }
}

export interface Voice {
  supported: boolean
  speaking: boolean
  enabled: boolean
  setEnabled: (on: boolean) => void
  speak: (text: string) => void
  silence: () => void
}

/** Strip the things that read badly aloud: markdown marks, ids, emoji. */
function forSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\br-[a-z0-9-]+\b/g, '')
    .replace(/[*_`#>|]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700)
}

/** Reads replies aloud, off by default so the app never surprises a room. */
export function useVoice(): Voice {
  const [speaking, setSpeaking] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const silence = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text: string) => {
      if (!supported || !enabled) return
      const clean = forSpeech(text)
      if (!clean) return
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(clean)
      u.rate = 1.04
      u.pitch = 0.95
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      setSpeaking(true)
      window.speechSynthesis.speak(u)
    },
    [enabled, supported],
  )

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel() }, [supported])

  const setEnabledAnd = useCallback(
    (on: boolean) => {
      setEnabled(on)
      if (!on) silence()
    },
    [silence],
  )

  return { supported, speaking, enabled, setEnabled: setEnabledAnd, speak, silence }
}
