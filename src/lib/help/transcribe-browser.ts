'use client'

type AsrResult = { text?: string } | { text?: string }[]

type TransformersMod = {
  env: { allowLocalModels: boolean; useBrowserCache: boolean }
  pipeline: (
    task: 'automatic-speech-recognition',
    model: string,
    options?: { dtype?: string; device?: string },
  ) => Promise<(audio: Float32Array, opts?: Record<string, unknown>) => Promise<AsrResult>>
}

let asrPromise: Promise<(audio: Float32Array) => Promise<string>> | null = null

function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const out = new Float32Array(Math.round(input.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio
    const i0 = Math.floor(x)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const frac = x - i0
    out[i] = input[i0] * (1 - frac) + input[i1] * frac
  }
  return out
}

async function blobToMono16k(blob: Blob): Promise<Float32Array> {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) throw new Error('This browser cannot process voice audio.')
  const ctx = new Ctor()
  const raw = await blob.arrayBuffer()
  const audio = await ctx.decodeAudioData(raw.slice(0))
  const channel = audio.getChannelData(0)
  const samples = resample(channel, audio.sampleRate, 16_000)
  await ctx.close().catch(() => undefined)
  return samples
}

async function loadAsr() {
  if (!asrPromise) {
    asrPromise = (async () => {
      const load = new Function('u', 'return import(u)') as (u: string) => Promise<TransformersMod>
      const mod = await load('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2/+esm')
      mod.env.allowLocalModels = false
      mod.env.useBrowserCache = true
      const pipe = await mod.pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        dtype: 'q8',
        device: 'wasm',
      })
      return async (audio: Float32Array) => {
        const result = await pipe(audio, {
          sampling_rate: 16_000,
          language: 'english',
          task: 'transcribe',
        })
        const row = Array.isArray(result) ? result[0] : result
        return (row?.text ?? '').trim()
      }
    })()
  }
  return asrPromise
}

/** On-device Whisper for browsers without Web Speech Recognition (Firefox). */
export async function transcribeInBrowser(blob: Blob): Promise<string> {
  const samples = await blobToMono16k(blob)
  if (samples.length < 1600) return ''
  const asr = await loadAsr()
  return asr(samples)
}
