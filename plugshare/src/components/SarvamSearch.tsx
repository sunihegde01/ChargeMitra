import { useEffect, useRef, useState } from 'react'
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

const inputClass = 'min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15'

export function SarvamSearch({ onApply }: Props) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<ChargerSearchFilters | null>(null)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  async function parseSearch(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setBusy(true)
    setErrorMessage('')
    try {
      const { data, error } = await supabase.functions.invoke<{ filters: ChargerSearchFilters }>(
        'sarvam-assistant',
        { body: { action: 'parse-search', query: trimmed } },
      )
      if (error) throw new Error(error.message)
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
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMessage('Voice search is not supported in this browser.')
      return
    }
    if (!window.isSecureContext) {
      setErrorMessage('Microphone access requires localhost or HTTPS.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus']
        .find((candidate) => MediaRecorder.isTypeSupported(candidate))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        setErrorMessage('Recording failed. Check microphone permissions and try again.')
        setRecording(false)
      }
      recorder.onstop = () => {
        if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        setRecording(false)
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (audio.size === 0) {
          setErrorMessage('No audio was recorded. Try again.')
          return
        }
        void transcribe(audio)
      }
      recorder.start()
      setRecording(true)
      timeoutRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, 25_000)
    } catch (error) {
      setErrorMessage(error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow access in your browser settings and try again.'
        : error instanceof Error ? error.message : 'Could not start microphone recording.')
    }
  }

  async function transcribe(audio: Blob) {
    setBusy(true)
    try {
      const formData = new FormData()
      const extension = audio.type.includes('ogg') ? 'ogg' : 'webm'
      formData.append('file', audio, `charger-search.${extension}`)
      const { data, error } = await supabase.functions.invoke<{ transcript: string }>(
        'sarvam-assistant',
        { body: formData, headers: { 'x-sarvam-action': 'transcribe' } },
      )
      if (error) throw new Error(error.message)
      if (!data?.transcript?.trim()) throw new Error('No speech was recognized. Try again.')
      setQuery(data.transcript)
      await parseSearch(data.transcript)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Speech transcription failed. Text search is still available.')
    } finally {
      setBusy(false)
    }
  }

  function updateFilter<K extends keyof ChargerSearchFilters>(key: K, value: ChargerSearchFilters[K]) {
    if (!filters) return
    const updated = { ...filters, [key]: value }
    setFilters(updated)
    onApply(query, updated)
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
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
          placeholder="Type your charger search"
          value={query}
        />
        <button
          className="rounded-xl border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-60"
          disabled={busy}
          onClick={() => recording ? stopRecording() : void startRecording()}
          type="button"
        >
          {recording ? 'Stop recording' : '🎙 Speak'}
        </button>
        <button
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={busy || recording || !query.trim()}
          onClick={() => void parseSearch(query)}
          type="button"
        >
          {busy ? 'Searching…' : 'Search'}
        </button>
      </div>
      {recording && <p className="mt-2 text-sm text-emerald-800" role="status">Listening… recording stops automatically after 25 seconds.</p>}
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
