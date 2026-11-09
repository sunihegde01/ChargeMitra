import { useEffect, useRef, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export type ChargerSearchFilters = {
  location: string | null
  connector_type: string | null
  minimum_power_kw: number | null
  date: string | null
  time: string | null
  maximum_price_per_unit: number | null
}

type Props = {
  onApply: (query: string, filters: ChargerSearchFilters) => void
}

type RealtimeEvent = {
  event?: string
  text?: string
  message?: string
  code?: string
  is_fatal?: boolean
}

const inputClass = 'min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15'
const sampleRate = 16_000

function joinTranscript(first: string, second: string): string {
  return [first.trim(), second.trim()].filter(Boolean).join(' ').replace(/\s+/g, ' ')
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const body = await error.context.clone().json() as { error?: unknown; message?: unknown }
      if (typeof body.error === 'string') return body.error
      if (typeof body.message === 'string') return body.message
    } catch {
      return error.message
    }
  }
  return error instanceof Error ? error.message : 'Could not interpret the charger search.'
}

function audioToBase64(audio: Float32Array, inputSampleRate: number): string {
  const ratio = inputSampleRate / sampleRate
  const outputLength = Math.floor(audio.length / ratio)
  const bytes = new Uint8Array(outputLength * 2)
  const view = new DataView(bytes.buffer)

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio)
    const end = Math.min(Math.floor((outputIndex + 1) * ratio), audio.length)
    let total = 0
    for (let inputIndex = start; inputIndex < end; inputIndex += 1) total += audio[inputIndex]
    const average = total / Math.max(end - start, 1)
    const sample = Math.max(-1, Math.min(1, average))
    view.setInt16(outputIndex * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }

  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function SarvamSearch({ onApply }: Props) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<ChargerSearchFilters | null>(null)
  const [recording, setRecording] = useState(false)
  const [finishingRecording, setFinishingRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const socketRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const finalizedTranscriptRef = useRef('')
  const partialTranscriptRef = useRef('')
  const shouldSearchOnEndRef = useRef(false)
  const capturingRef = useRef(false)
  const limitTimerRef = useRef<number | null>(null)

  function stopAudioCapture() {
    capturingRef.current = false
    if (limitTimerRef.current !== null) window.clearTimeout(limitTimerRef.current)
    limitTimerRef.current = null
    if (processorRef.current) processorRef.current.onaudioprocess = null
    processorRef.current?.disconnect()
    sourceRef.current?.disconnect()
    processorRef.current = null
    sourceRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    void audioContextRef.current?.close()
    audioContextRef.current = null
  }

  function closeLiveTranscription() {
    stopAudioCapture()
    const socket = socketRef.current
    socketRef.current = null
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close()
    setRecording(false)
    setFinishingRecording(false)
  }

  useEffect(() => () => {
    shouldSearchOnEndRef.current = false
    if (limitTimerRef.current !== null) window.clearTimeout(limitTimerRef.current)
    stopAudioCapture()
    const socket = socketRef.current
    socketRef.current = null
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close()
  }, [])

  async function parseSearch(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setBusy(true)
    setErrorMessage('')
    try {
      const { data, error } = await supabase.functions.invoke<{ filters: ChargerSearchFilters }>(
        'sarvam-assistant',
        { body: { query: trimmed } },
      )
      if (error) throw new Error(await getFunctionErrorMessage(error))
      const parsed = data?.filters
      if (!parsed || typeof parsed !== 'object') throw new Error('Sarvam returned invalid search filters.')
      const normalized: ChargerSearchFilters = {
        location: typeof parsed.location === 'string' ? parsed.location : null,
        connector_type: typeof parsed.connector_type === 'string' ? parsed.connector_type : null,
        minimum_power_kw: typeof parsed.minimum_power_kw === 'number' && parsed.minimum_power_kw > 0
          ? parsed.minimum_power_kw
          : null,
        date: typeof parsed.date === 'string' ? parsed.date : null,
        time: typeof parsed.time === 'string' ? parsed.time : null,
        maximum_price_per_unit: typeof parsed.maximum_price_per_unit === 'number'
          && parsed.maximum_price_per_unit >= 0
          ? parsed.maximum_price_per_unit
          : null,
      }
      setFilters(normalized)
      onApply(trimmed, normalized)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not understand that search. You can still search with the text field below.')
    } finally {
      setBusy(false)
    }
  }

  async function startRecording() {
    setErrorMessage('')
    setFilters(null)
    finalizedTranscriptRef.current = ''
    partialTranscriptRef.current = ''
    shouldSearchOnEndRef.current = false
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined' || typeof WebSocket === 'undefined') {
      setErrorMessage('Live voice search is not supported in this browser.')
      return
    }
    if (!window.isSecureContext) {
      setErrorMessage('Microphone access requires localhost or HTTPS.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      streamRef.current = stream
      const context = new AudioContext()
      audioContextRef.current = context
      await context.resume()
      const { data, error } = await supabase.auth.getSession()
      if (error) throw new Error(error.message)
      const token = data.session?.access_token
      if (!token) throw new Error('Sign in again to use live voice search.')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
      const socketUrl = new URL(`${supabaseUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')}/functions/v1/sarvam-assistant`)
      socketUrl.searchParams.set('action', 'live-transcribe')
      socketUrl.searchParams.set('apikey', anonKey)
      socketUrl.searchParams.set('jwt', token)
      const socket = new WebSocket(socketUrl)
      socketRef.current = socket

      socket.onopen = () => {
        const source = context.createMediaStreamSource(stream)
        const processor = context.createScriptProcessor(4096, 1, 1)
        const silentOutput = context.createGain()
        silentOutput.gain.value = 0
        processor.onaudioprocess = (event) => {
          if (socket.readyState !== WebSocket.OPEN) return
          const audio = event.inputBuffer.getChannelData(0)
          const base64 = audioToBase64(audio, context.sampleRate)
          if (base64) socket.send(JSON.stringify({ event: 'audio_input', audio: base64 }))
        }
        source.connect(processor)
        processor.connect(silentOutput)
        silentOutput.connect(context.destination)
        audioContextRef.current = context
        sourceRef.current = source
        processorRef.current = processor
        capturingRef.current = true
        setRecording(true)
        limitTimerRef.current = window.setTimeout(() => stopRecording(), 60_000)
      }

      socket.onmessage = (message) => {
        let event: RealtimeEvent
        try {
          event = JSON.parse(String(message.data)) as RealtimeEvent
        } catch {
          setErrorMessage('The live transcription service sent an invalid response.')
          closeLiveTranscription()
          return
        }
        if (event.event === 'relay.ready') return
        if (event.event === 'transcript.partial' && typeof event.text === 'string') {
          partialTranscriptRef.current = event.text
          setQuery(joinTranscript(finalizedTranscriptRef.current, event.text))
        } else if (event.event === 'transcript.final' && typeof event.text === 'string') {
          finalizedTranscriptRef.current = joinTranscript(finalizedTranscriptRef.current, event.text)
          partialTranscriptRef.current = ''
          setQuery(finalizedTranscriptRef.current)
        } else if (event.event === 'error') {
          setErrorMessage(event.message || `Live transcription failed${event.code ? ` (${event.code})` : ''}.`)
          shouldSearchOnEndRef.current = false
          closeLiveTranscription()
        } else if (event.event === 'session.end') {
          const transcript = joinTranscript(finalizedTranscriptRef.current, partialTranscriptRef.current)
          setQuery(transcript)
          const shouldSearch = shouldSearchOnEndRef.current
          shouldSearchOnEndRef.current = false
          closeLiveTranscription()
          if (shouldSearch && transcript) void parseSearch(transcript)
          else if (!transcript) setErrorMessage('No speech was recognized. Try speaking closer to the microphone.')
        }
      }

      socket.onerror = () => {
        setErrorMessage('Could not connect to live speech transcription. Check your connection and try again.')
        shouldSearchOnEndRef.current = false
        closeLiveTranscription()
      }
      socket.onclose = (event) => {
        if (socketRef.current !== socket) return
        stopAudioCapture()
        socketRef.current = null
        setRecording(false)
        setFinishingRecording(false)
        if (event.code !== 1000 && event.code !== 1005) {
          setErrorMessage(event.reason || `Live transcription connection closed (${event.code}).`)
          shouldSearchOnEndRef.current = false
        }
      }
    } catch (error) {
      stopAudioCapture()
      setErrorMessage(error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow access in your browser settings and try again.'
        : error instanceof Error ? error.message : 'Could not start live voice search.')
    }
  }

  function stopRecording() {
    if (!capturingRef.current || finishingRecording) return
    shouldSearchOnEndRef.current = true
    capturingRef.current = false
    setRecording(false)
    setFinishingRecording(true)
    stopAudioCapture()
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ event: 'end' }))
    } else {
      closeLiveTranscription()
    }
  }

  function updateFilter<K extends keyof ChargerSearchFilters>(key: K, value: ChargerSearchFilters[K]) {
    if (!filters) return
    const updated = { ...filters, [key]: value }
    setFilters(updated)
    onApply(query, updated)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label="Voice and text charger search">
      <label className="block text-sm font-medium" htmlFor="sarvam-search-query">Describe the charger you need</label>
      <p className="mt-1 text-xs text-slate-500">Search in English, Kannada, or Hindi. For example: “CCS2 charger under ₹20 per unit in Bengaluru tomorrow”.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className={`${inputClass} flex-1`}
          id="sarvam-search-query"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void parseSearch(query)
            }
          }}
          placeholder={recording ? 'Live transcript appears here as you speak…' : 'Type your charger search'}
          value={query}
        />
        <button
          aria-pressed={recording || finishingRecording}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60 ${recording ? 'border-red-700 text-red-800' : 'border-emerald-700 text-emerald-800'}`}
          disabled={busy || finishingRecording}
          onClick={() => recording ? stopRecording() : void startRecording()}
          type="button"
        >
          {finishingRecording ? 'Finishing…' : recording ? 'Stop & search' : '🎙 Speak'}
        </button>
        <button
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={busy || recording || finishingRecording || !query.trim()}
          onClick={() => void parseSearch(query)}
          type="button"
        >
          {busy ? 'Searching…' : 'Search'}
        </button>
      </div>
      {recording && <p className="mt-2 text-sm text-emerald-800" role="status">Listening — recognized words appear live. Stop to apply search filters.</p>}
      {finishingRecording && <p className="mt-2 text-sm text-emerald-800" role="status">Finishing transcription…</p>}
      {errorMessage && <p className="mt-2 text-sm text-red-700" role="alert">{errorMessage}</p>}
      {filters && (
        <fieldset className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="px-1 text-sm font-semibold">Detected filters — edit to refine</legend>
          <label className="grid gap-1 text-xs font-medium text-slate-600">Location
            <input className={inputClass} onChange={(event) => updateFilter('location', event.target.value || null)} value={filters.location ?? ''} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">Connector type
            <input className={inputClass} onChange={(event) => updateFilter('connector_type', event.target.value || null)} value={filters.connector_type ?? ''} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">Minimum power (kW)
            <input className={inputClass} min="0" onChange={(event) => updateFilter('minimum_power_kw', event.target.value ? Number(event.target.value) : null)} type="number" value={filters.minimum_power_kw ?? ''} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">Date
            <input className={inputClass} onChange={(event) => updateFilter('date', event.target.value || null)} type="date" value={filters.date ?? ''} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">Time
            <input className={inputClass} onChange={(event) => updateFilter('time', event.target.value || null)} type="time" value={filters.time ?? ''} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">Maximum price (₹/unit)
            <input className={inputClass} min="0" onChange={(event) => updateFilter('maximum_price_per_unit', event.target.value ? Number(event.target.value) : null)} type="number" value={filters.maximum_price_per_unit ?? ''} />
          </label>
        </fieldset>
      )}
      {filters && (filters.date || filters.time) && (
        <p className="mt-3 text-xs text-slate-500">
          The detected date and time prefill your booking request. Slot availability is checked when you send the request.
        </p>
      )}
    </section>
  )
}
