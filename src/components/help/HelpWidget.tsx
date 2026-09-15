'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  CircleHelp, Loader2, MessageCircle, Mic, MicOff, Send, Sparkles, Volume2, VolumeX, X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  canRecordAudio,
  getSpeechRecognitionCtor,
  preloadVoices,
  speakText,
  stopSpeaking,
  voiceSupported,
  type SpeechRecognitionLike,
} from '@/lib/help/speech'
import { micPermissionMessage, startMicRecording, type MicRecording } from '@/lib/help/mic-record'
import { transcribeAudio } from '@/lib/help/transcribe'
import type { HelpAllowedPage, HelpPageContext } from '@/lib/help/types'

type Tab = 'guide' | 'ask'

type ChatMsg = { role: 'user' | 'assistant'; content: string }

type ContextPayload = {
  role: string
  chatEnabled: boolean
  page: HelpPageContext | null
  allowedPages: HelpAllowedPage[]
}

const seenKey = (path: string) => `wsso-help-seen:${path}`
const voicePrefKey = 'wsso-help-speak-replies'

export function HelpWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('guide')
  const [ctx, setCtx] = useState<ContextPayload | null>(null)
  const [loadingCtx, setLoadingCtx] = useState(true)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [interim, setInterim] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [speakReplies, setSpeakReplies] = useState(true)
  const [voice, setVoice] = useState({ listen: false, speak: false })
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const mediaRef = useRef<MicRecording | null>(null)
  const speakRepliesRef = useRef(true)
  const messagesRef = useRef<ChatMsg[]>([])
  const sendingRef = useRef(false)

  useEffect(() => {
    setVoice(voiceSupported())
    preloadVoices()
    try {
      const stored = localStorage.getItem(voicePrefKey)
      if (stored === '0') {
        setSpeakReplies(false)
        speakRepliesRef.current = false
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    sendingRef.current = sending
  }, [sending])

  const load = useCallback(async (path: string) => {
    setLoadingCtx(true)
    try {
      const res = await fetch(`/api/help/context?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load help')
      setCtx(json as ContextPayload)
    } catch {
      setCtx(null)
    } finally {
      setLoadingCtx(false)
    }
  }, [])

  useEffect(() => {
    void load(pathname)
    setMessages([])
    setChatError(null)
    setTab('guide')
    stopSpeaking()
    setSpeaking(false)
    recRef.current?.abort?.()
    recRef.current = null
    mediaRef.current?.cancel()
    mediaRef.current = null
    setListening(false)
    setInterim('')
  }, [pathname, load])

  useEffect(() => {
    if (loadingCtx || !ctx?.page) return
    try {
      if (!localStorage.getItem(seenKey(pathname))) {
        setOpen(true)
        setTab('guide')
      }
    } catch {
      /* ignore */
    }
  }, [loadingCtx, ctx?.page, pathname])

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: Tab }>).detail
      setOpen(true)
      if (detail?.tab) setTab(detail.tab)
    }
    window.addEventListener('wsso-open-help', onOpen)
    return () => window.removeEventListener('wsso-open-help', onOpen)
  }, [])

  useEffect(() => {
    if (!open || !ctx?.page) return
    try {
      localStorage.setItem(seenKey(pathname), '1')
    } catch {
      /* ignore */
    }
  }, [open, ctx?.page, pathname])

  useEffect(() => {
    if (!open) {
      stopSpeaking()
      setSpeaking(false)
      recRef.current?.abort?.()
      recRef.current = null
      mediaRef.current?.cancel()
      mediaRef.current = null
      setListening(false)
    }
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, sending, open, tab, interim])

  const speakReply = useCallback((text: string) => {
    if (!speakRepliesRef.current || !voiceSupported().speak) return
    speakText(text, {
      onstart: () => setSpeaking(true),
      onend: () => setSpeaking(false),
    })
  }, [])

  const send = useCallback(async (text: string, opts?: { fromVoice?: boolean }) => {
    const message = text.trim()
    if (!message || sendingRef.current) return
    const history = messagesRef.current
    const nextHistory = [...history, { role: 'user' as const, content: message }]
    setMessages(nextHistory)
    setDraft('')
    setSending(true)
    sendingRef.current = true
    setChatError(null)
    setTab('ask')
    stopSpeaking()
    setSpeaking(false)

    try {
      const res = await fetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          path: pathname,
          history,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not answer')
      const reply = json.reply as string
      setMessages([...nextHistory, { role: 'assistant', content: reply }])
      if (opts?.fromVoice || speakRepliesRef.current) speakReply(reply)
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Could not answer'
      setChatError(err)
      setMessages(nextHistory)
    } finally {
      setSending(false)
      sendingRef.current = false
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [pathname, speakReply])

  const stopListen = useCallback(() => {
    recRef.current?.stop()
    recRef.current = null
    mediaRef.current?.stop()
    mediaRef.current = null
  }, [])

  const startMediaFallback = useCallback(async () => {
    if (!canRecordAudio()) {
      setChatError('Allow the microphone to ask with voice, or type your question.')
      return
    }

    try {
      const rec = await startMicRecording({
        onBlob: async (blob) => {
          mediaRef.current = null
          setListening(false)
          if (blob.size < 800) {
            setChatError('Could not hear that. Try again, or type.')
            return
          }
          setTranscribing(true)
          setInterim('')
          try {
            const text = await transcribeAudio(blob)
            if (text) void send(text, { fromVoice: true })
            else setChatError('Could not hear that. Try again, or type.')
          } catch {
            setChatError('Could not transcribe that. Type your question instead.')
          } finally {
            setTranscribing(false)
          }
        },
        onError: (message) => {
          mediaRef.current = null
          setListening(false)
          setChatError(message)
        },
      })
      mediaRef.current = rec
      setListening(true)
      setInterim('')
    } catch (err) {
      setListening(false)
      setChatError(micPermissionMessage(err))
    }
  }, [send])

  const startListen = useCallback(() => {
    if (listening || transcribing) {
      stopListen()
      return
    }

    stopSpeaking()
    setSpeaking(false)
    setChatError(null)
    setTab('ask')

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      void startMediaFallback()
      return
    }

    const rec = new Ctor()
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1
    recRef.current = rec

    rec.onresult = (ev) => {
      let finalText = ''
      let live = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i][0].transcript
        if (ev.results[i].isFinal) finalText += piece
        else live += piece
      }
      if (live) setInterim(live)
      if (finalText.trim()) {
        setInterim('')
        setDraft(finalText.trim())
        void send(finalText, { fromVoice: true })
      }
    }

    rec.onerror = (ev) => {
      setListening(false)
      setInterim('')
      recRef.current = null
      if (ev.error === 'not-allowed') {
        setChatError('Microphone permission was blocked. Allow the mic, or type your question.')
        return
      }
      if (ev.error === 'network' || ev.error === 'service-not-allowed' || ev.error === 'audio-capture') {
        void startMediaFallback()
        return
      }
      if (ev.error !== 'aborted' && ev.error !== 'no-speech') {
        setChatError('Could not hear that. Try again, or type.')
      }
    }

    rec.onend = () => {
      setListening(false)
      recRef.current = null
    }

    try {
      rec.start()
      setListening(true)
      setInterim('')
    } catch {
      recRef.current = null
      void startMediaFallback()
    }
  }, [listening, transcribing, send, startMediaFallback, stopListen])

  const toggleSpeakReplies = () => {
    const next = !speakReplies
    setSpeakReplies(next)
    speakRepliesRef.current = next
    try {
      localStorage.setItem(voicePrefKey, next ? '1' : '0')
    } catch {
      /* ignore */
    }
    if (!next) {
      stopSpeaking()
      setSpeaking(false)
    }
  }

  const page = ctx?.page
  const roleLabel = ctx?.role ? ctx.role.replace('_', ' ') : ''

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close help' : 'Open WSSO help'}
        className={cn(
          'fixed bottom-20 right-5 z-[80] flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-colors',
          'bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        )}
      >
        {open ? <X className="h-5 w-5" /> : <CircleHelp className="h-5 w-5" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="WSSO help"
          className="fixed bottom-[8.5rem] right-5 z-[80] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl"
          style={{ maxHeight: 'min(34rem, calc(100dvh - 10rem))' }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-neutral-200 bg-primary-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">WSSO Help</p>
              <p className="truncate text-xs text-neutral-500">
                {page ? page.title : 'This page'}
                {roleLabel ? ` · ${roleLabel}` : ''}
                {' · US English female'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {voice.speak && (
                <button
                  type="button"
                  onClick={toggleSpeakReplies}
                  title={speakReplies ? 'Mute spoken replies' : 'Speak replies'}
                  aria-label={speakReplies ? 'Mute spoken replies' : 'Speak replies'}
                  className={cn(
                    'rounded p-1 transition-colors',
                    speakReplies ? 'text-primary-700 hover:bg-primary-100' : 'text-neutral-400 hover:text-neutral-700',
                  )}
                >
                  {speakReplies ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-neutral-400 hover:text-neutral-700"
                aria-label="Close help"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex border-b border-neutral-200">
            <TabBtn active={tab === 'guide'} onClick={() => setTab('guide')} icon={Sparkles} label="This page" />
            <TabBtn active={tab === 'ask'} onClick={() => setTab('ask')} icon={MessageCircle} label="Ask" />
          </div>

          {tab === 'guide' ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {loadingCtx ? (
                <p className="flex items-center gap-2 text-sm text-neutral-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading guide…
                </p>
              ) : page ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-neutral-700">{page.youAreHere}</p>
                  <p className="text-xs text-neutral-500">{page.summary}</p>
                  <ol className="list-decimal space-y-1.5 pl-4 text-sm text-neutral-800">
                    {page.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {page.tips.length > 0 && (
                    <div className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                      {page.tips.map((tip) => (
                        <p key={tip} className="mt-1 first:mt-0">{tip}</p>
                      ))}
                    </div>
                  )}
                  {page.suggestedQuestions.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                        Ask about this page
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {page.suggestedQuestions.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => void send(q)}
                            className="rounded-md border border-neutral-200 px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-neutral-600">
                  No specific tour for this screen. Open Ask and question a page you can see in the sidebar.
                </p>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
                {messages.length === 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-neutral-600">
                      Type or tap the mic to ask about{' '}
                      <span className="font-medium text-neutral-800">{page?.title ?? 'WSSO'}</span>
                      {' '}for your role. I will not explain pages you cannot open.
                    </p>
                    {ctx?.allowedPages && ctx.allowedPages.length > 0 && (
                      <p className="text-[11px] leading-relaxed text-neutral-400">
                        I can help with: {ctx.allowedPages.map((p) => p.title).join(', ')}.
                      </p>
                    )}
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={`${m.role}-${i}`}
                    className={cn(
                      'max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                      m.role === 'user'
                        ? 'ml-auto bg-primary-600 text-white'
                        : 'bg-neutral-100 text-neutral-800',
                    )}
                  >
                    <p>{m.content}</p>
                    {m.role === 'assistant' && voice.speak && (
                      <button
                        type="button"
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-primary-700"
                        onClick={() => speakReply(m.content)}
                      >
                        <Volume2 className="h-3 w-3" /> Play
                      </button>
                    )}
                  </div>
                ))}
                {listening && (
                  <p className="flex items-center gap-2 text-xs text-primary-700">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-danger-500" />
                    Listening… {interim || 'tap the mic again when you finish'}
                  </p>
                )}
                {transcribing && (
                  <p className="flex items-center gap-2 text-xs text-neutral-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Hearing that…
                  </p>
                )}
                {sending && (
                  <p className="flex items-center gap-2 text-xs text-neutral-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                  </p>
                )}
                {speaking && (
                  <button
                    type="button"
                    onClick={() => { stopSpeaking(); setSpeaking(false) }}
                    className="text-xs text-primary-700 hover:underline"
                  >
                    Speaking… tap to stop
                  </button>
                )}
                {chatError && <p className="text-xs text-danger-600">{chatError}</p>}
              </div>

              <form
                className="border-t border-neutral-200 p-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  void send(draft)
                }}
              >
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void send(draft)
                      }
                    }}
                    rows={2}
                    maxLength={1000}
                    placeholder={listening ? 'Listening…' : transcribing ? 'Hearing that…' : 'Type or use the mic…'}
                    className="min-h-[2.5rem] flex-1 resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={startListen}
                    disabled={sending || transcribing}
                    aria-label={listening ? 'Stop listening' : 'Ask with voice'}
                    title={listening ? 'Stop' : 'Ask with voice'}
                    className={cn(
                      'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors',
                      listening
                        ? 'border-danger-500 bg-danger-500 text-white'
                        : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50',
                      sending && 'opacity-50',
                    )}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <Button type="submit" size="sm" disabled={sending || listening || transcribing || !draft.trim()} aria-label="Send">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Sparkles
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium',
        active
          ? 'border-b-2 border-primary-600 text-primary-700'
          : 'text-neutral-500 hover:text-neutral-800',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
