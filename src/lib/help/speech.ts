'use client'

export type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: {
    length: number
    [index: number]: {
      isFinal: boolean
      0: { transcript: string }
    }
  }
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

const FEMALE_HINT =
  /zira|aria|jenny|samantha|susan|hazel|karen|moira|tessa|fiona|victoria|allison|ava|emma|michelle|linda|heera|zira|salli|ivy|joanna|kendra|kimberly|nicole|raveena|aditi|female/i
const MALE_HINT =
  /david|mark|guy|davis|ryan|christopher|steffan|eric|andrew|brian|richard|george|fred|daniel|\balex\b|tony|maurice|guy|male/i

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function voiceSupported(): { listen: boolean; speak: boolean } {
  if (typeof window === 'undefined') return { listen: false, speak: false }
  return {
    listen: Boolean(getSpeechRecognitionCtor()),
    speak: 'speechSynthesis' in window,
  }
}

function scoreUsFemale(voice: SpeechSynthesisVoice): number {
  const lang = (voice.lang || '').toLowerCase().replace('_', '-')
  let score = 0
  if (lang === 'en-us') score += 60
  else if (lang.startsWith('en-us')) score += 55
  else if (lang.startsWith('en')) score += 8
  else score -= 20
  if (FEMALE_HINT.test(voice.name)) score += 45
  if (MALE_HINT.test(voice.name)) score -= 80
  if (/neural|natural|online/i.test(voice.name)) score += 10
  if (voice.localService) score += 4
  return score
}

export function pickUsFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const ranked = voices.slice().sort((a, b) => scoreUsFemale(b) - scoreUsFemale(a))
  const best = ranked[0]
  if (best && scoreUsFemale(best) >= 50) return best
  return voices.find((v) => (v.lang || '').toLowerCase().replace('_', '-').startsWith('en-us')) ?? best ?? null
}

/** Chrome loads voices asynchronously — call once when the help panel mounts. */
export function preloadVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.getVoices()
  if (typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      window.speechSynthesis.getVoices()
    }, { once: true })
  }
}

export function speakText(text: string, opts?: { onend?: () => void; onstart?: () => void }) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    opts?.onend?.()
    return
  }
  window.speechSynthesis.cancel()
  const cleaned = text
    .replace(/[*_#`>]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (!cleaned) {
    opts?.onend?.()
    return
  }

  let started = false
  const start = () => {
    if (started) return
    started = true
    const utter = new SpeechSynthesisUtterance(cleaned)
    utter.lang = 'en-US'
    const voice = pickUsFemaleVoice()
    if (voice) utter.voice = voice
    utter.rate = 0.98
    utter.pitch = voice && FEMALE_HINT.test(voice.name) ? 1.04 : 1.18
    utter.onstart = () => opts?.onstart?.()
    utter.onend = () => opts?.onend?.()
    utter.onerror = () => opts?.onend?.()
    window.speechSynthesis.speak(utter)
  }

  if (window.speechSynthesis.getVoices().length > 0) {
    start()
    return
  }

  const onReady = () => start()
  window.speechSynthesis.addEventListener('voiceschanged', onReady, { once: true })
  window.setTimeout(() => {
    window.speechSynthesis.removeEventListener('voiceschanged', onReady)
    start()
  }, 400)
}

export function stopSpeaking() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
}
