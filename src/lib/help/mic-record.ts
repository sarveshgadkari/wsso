'use client'

export type MicRecording = {
  stop: () => void
  cancel: () => void
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
]

export function pickAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return ''
  }
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export function audioFileName(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'help-voice.m4a'
  if (mimeType.includes('ogg')) return 'help-voice.ogg'
  if (mimeType.includes('wav')) return 'help-voice.wav'
  return 'help-voice.webm'
}

export function startMicRecording(opts: {
  onBlob: (blob: Blob) => void
  onError: (message: string) => void
  maxMs?: number
}): Promise<MicRecording> {
  const mimeType = pickAudioMimeType()

  return navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)
    const chunks: Blob[] = []
    let timeoutId = 0
    let finished = false
    let cancelled = false

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId)
      stream.getTracks().forEach((track) => track.stop())
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data)
    }

    recorder.onerror = () => {
      if (finished) return
      finished = true
      cleanup()
      if (!cancelled) opts.onError('Could not start the microphone.')
    }

    recorder.onstop = () => {
      if (finished) return
      finished = true
      cleanup()
      if (cancelled) return
      const type = recorder.mimeType || mimeType || 'audio/webm'
      opts.onBlob(new Blob(chunks, { type }))
    }

    try {
      recorder.start(250)
    } catch {
      cleanup()
      throw new Error('Could not start the microphone.')
    }

    timeoutId = window.setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop()
    }, opts.maxMs ?? 20_000)

    const halt = (drop: boolean) => {
      cancelled = drop
      if (recorder.state === 'recording') {
        try {
          recorder.requestData()
        } catch {
          /* Safari / Firefox may not implement requestData */
        }
        recorder.stop()
      } else {
        cleanup()
      }
    }

    return {
      stop: () => halt(false),
      cancel: () => halt(true),
    }
  })
}

export function micPermissionMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone permission was blocked. Allow the mic, or type your question.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found. Plug one in, or type your question.'
  }
  return 'Could not start the microphone. Type your question instead.'
}
