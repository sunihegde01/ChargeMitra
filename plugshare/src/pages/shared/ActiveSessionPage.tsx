import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChargerDirections } from '../../components/ChargerDirections'
import { useAuth } from '../../context/AuthContext'
import { parsePoint, type Point } from '../../location'
import { supabase } from '../../supabase'

type Session = {
  id: string
  booking_id: string
  calculation_method: string | null
  method_confirmed_by_owner: boolean
  provider_approved_at: string | null
  started_at: string | null
  ended_at: string | null
  paused_seconds: number
  paused_at: string | null
  initial_meter_reading: number | null
  final_meter_reading: number | null
  actual_kwh: number | null
  estimated_kwh: number | null
  compatible_power_kw: number | null
  average_power_factor: number
  estimated_average_power_kw: number | null
  final_amount: number | null
  active_duration_seconds: number | null
  status: string
}
type SessionEvent = { event_type: string; recorded_at: string }
type Booking = {
  charger_id: string
  owner_id: string
  provider_id: string
  price_per_kwh_snapshot: number
  estimated_total_snapshot: number | null
  payment_method: string | null
  scheduled_start: string
  scheduled_end: string
}
type Charger = { name: string; charger_type: string; rated_power_kw: number; connector_type: string }

function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours ? `${hours} hr ${minutes} min` : `${minutes} min`
}

export default function ActiveSessionPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [session, setSession] = useState<Session | null>(null)
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([])
  const [booking, setBooking] = useState<Booking | null>(null)
  const [charger, setCharger] = useState<Charger | null>(null)
  const [chargerLocation, setChargerLocation] = useState<Point | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [isProvider, setIsProvider] = useState(false)
  const [initialReading, setInitialReading] = useState('')
  const [finalReading, setFinalReading] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const loadSession = useCallback(async () => {
    if (!id) {
      setErrorMessage('No charging session ID was provided.')
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')
    setChargerLocation(null)
    setSessionEvents([])
    const { data: sessionRow, error: sessionError } = await supabase
      .from('charging_sessions')
      .select('id,booking_id,calculation_method,method_confirmed_by_owner,provider_approved_at,started_at,ended_at,paused_seconds,paused_at,initial_meter_reading,final_meter_reading,actual_kwh,estimated_kwh,compatible_power_kw,average_power_factor,estimated_average_power_kw,final_amount,active_duration_seconds,status')
      .eq('id', id)
      .maybeSingle()
    if (sessionError) {
      setErrorMessage(sessionError.message)
      setLoading(false)
      return
    }
    if (!sessionRow) {
      setErrorMessage('This session was not found or you do not have permission to view it.')
      setLoading(false)
      return
    }
    setSession(sessionRow)
    const { data: eventRows, error: eventsError } = await supabase
      .from('charging_session_events')
      .select('event_type,recorded_at')
      .eq('session_id', sessionRow.id)
      .order('recorded_at', { ascending: true })
    if (eventsError) setErrorMessage(`Could not load session event history: ${eventsError.message}`)
    else setSessionEvents(eventRows ?? [])

    const { data: bookingRow, error: bookingError } = await supabase
      .from('bookings')
      .select('charger_id,owner_id,provider_id,price_per_kwh_snapshot,estimated_total_snapshot,payment_method,scheduled_start,scheduled_end')
      .eq('id', sessionRow.booking_id)
      .maybeSingle()
    if (bookingError) {
      setErrorMessage(bookingError.message)
      setLoading(false)
      return
    }
    if (bookingRow) {
      setBooking(bookingRow)
      setIsOwner(bookingRow.owner_id === user?.id)
      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('profile_id,location')
        .eq('id', bookingRow.provider_id)
        .maybeSingle()
      if (providerError) setErrorMessage(providerError.message)
      setIsProvider(provider?.profile_id === user?.id)
      setChargerLocation(parsePoint(provider?.location))

      const { data: chargerRow, error: chargerError } = await supabase
        .from('chargers')
        .select('name,charger_type,rated_power_kw,connector_type')
        .eq('id', bookingRow.charger_id)
        .maybeSingle()
      if (chargerError) setErrorMessage(chargerError.message)
      else setCharger(chargerRow)
    }
    setLoading(false)
  }, [id, user?.id])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  async function performAction(event: { preventDefault: () => void }, action: string) {
    event.preventDefault()
    if (!id) return
    setSaving(true)
    setErrorMessage('')
    setSuccessMessage('')
    let error: { message: string } | null = null

    if (action === 'confirm-method') {
      if (!session?.calculation_method) {
        setErrorMessage('The provider has not selected a calculation method yet.')
        setSaving(false)
        return
      }
      const result = await supabase.rpc('confirm_session_method', {
        p_session_id: id,
        p_method: session.calculation_method,
      })
      error = result.error
    } else if (action === 'start-meter') {
      const result = await supabase.rpc('start_meter_session', {
        p_session_id: id,
        p_initial_reading: Number(initialReading),
      })
      error = result.error
    } else if (action === 'start-time') {
      const result = await supabase.rpc('start_time_based_session', { p_session_id: id })
      error = result.error
    } else if (action === 'stop-meter') {
      const result = await supabase.rpc('stop_meter_session', {
        p_session_id: id,
        p_final_reading: Number(finalReading),
      })
      error = result.error
    } else if (action === 'pause') {
      const result = await supabase.rpc('pause_charging_session', { p_session_id: id })
      error = result.error
    } else if (action === 'resume') {
      const result = await supabase.rpc('resume_charging_session', { p_session_id: id })
      error = result.error
    } else {
      const result = await supabase.rpc('stop_time_based_session', { p_session_id: id })
      error = result.error
    }

    if (error) {
      setErrorMessage(error.message)
    } else {
      setSuccessMessage('Session updated.')
      await loadSession()
    }
    setSaving(false)
  }

  const canControl = isOwner || isProvider
  const finalAmount = session?.status === 'STOPPED' ? session.final_amount : null

  return (
    <main className="min-h-screen bg-[#f7f9f6] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <Link className="text-sm font-semibold text-emerald-700" to={isProvider ? '/provider/dashboard' : '/owner/dashboard'}>← Dashboard</Link>
        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Charging session</p>
          <h1 className="mt-2 text-3xl font-semibold">Session details</h1>
          {loading && <p className="mt-6 text-slate-600">Loading session...</p>}
          {errorMessage && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-800" role="alert">{errorMessage}</p>}
          {successMessage && <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-800" role="status">{successMessage}</p>}
          {!loading && session && (
            <>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-5">
                <div>
                  <p className="font-semibold">{charger?.name ?? 'Charging station'}</p>
                  <p className="mt-1 text-sm text-slate-600">{charger ? `${charger.charger_type} · ${charger.rated_power_kw} kW · ${charger.connector_type}` : 'Station details unavailable'}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">{session.status}</span>
              </div>
              {isOwner && booking && charger && chargerLocation && (
                <ChargerDirections destination={chargerLocation} chargerName={charger.name} />
              )}
              {isOwner && booking && charger && !chargerLocation && (
                <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900" role="status">
                  The host has not added a map location for this charging station yet.
                </p>
              )}
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <dt className="text-sm text-slate-500">Agreed calculation</dt>
                  <dd className="mt-1 font-semibold">
                    {session.calculation_method === 'METER_BASED'
                      ? 'ACTUAL — Meter-based'
                      : session.calculation_method === 'TIME_BASED'
                        ? 'ESTIMATED — Time-based'
                        : 'Awaiting provider selection'}
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <dt className="text-sm text-slate-500">Calculation method</dt>
                  <dd className="mt-1 font-semibold">{session.calculation_method?.replace('_', ' ') ?? 'Not selected'}</dd>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <dt className="text-sm text-slate-500">Price snapshot</dt>
                  <dd className="mt-1 font-semibold">{booking ? `₹${booking.price_per_kwh_snapshot}/kWh` : 'Unavailable'}</dd>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <dt className="text-sm text-slate-500">Payment option</dt>
                  <dd className="mt-1 font-semibold">{booking?.payment_method === 'PAY_AT_STATION' ? 'Pay at station (cash/UPI)' : booking?.payment_method ?? 'Unavailable'}</dd>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <dt className="text-sm text-slate-500">
                    {session.status === 'STOPPED'
                      ? session.calculation_method === 'METER_BASED' ? 'ACTUAL amount — meter-based' : 'ESTIMATED amount — time-based'
                      : 'Estimated booking total'}
                  </dt>
                  <dd className="mt-1 font-semibold">
                    {finalAmount !== null
                      ? `₹${Number(finalAmount).toFixed(2)}`
                      : session.status === 'STOPPED'
                        ? 'Unavailable'
                      : booking?.estimated_total_snapshot != null
                        ? `₹${Number(booking.estimated_total_snapshot).toFixed(2)} (estimate)`
                        : 'Unavailable'}
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <dt className="text-sm text-slate-500">Started</dt>
                  <dd className="mt-1 font-semibold">{session.started_at ? new Date(session.started_at).toLocaleString() : 'Not started'}</dd>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <dt className="text-sm text-slate-500">Ended</dt>
                  <dd className="mt-1 font-semibold">{session.ended_at ? new Date(session.ended_at).toLocaleString() : 'In progress'}</dd>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <dt className="text-sm text-slate-500">Active charging duration</dt>
                  <dd className="mt-1 font-semibold">
                    {session.active_duration_seconds == null
                      ? 'Recorded when charging ends'
                      : formatDuration(Number(session.active_duration_seconds))}
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <dt className="text-sm text-slate-500">
                    {session.calculation_method === 'METER_BASED'
                      ? 'ACTUAL consumption — meter-based'
                      : session.calculation_method === 'TIME_BASED'
                        ? 'ESTIMATED consumption — time-based'
                        : 'Energy delivered'}
                  </dt>
                  <dd className="mt-1 font-semibold">
                    {session.actual_kwh != null ? `${session.actual_kwh} kWh (metered)` : session.estimated_kwh != null ? `${session.estimated_kwh} kWh (estimated)` : 'Not available'}
                  </dd>
                </div>
                {session.calculation_method === 'METER_BASED' && (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <dt className="text-sm text-slate-500">Meter readings</dt>
                    <dd className="mt-1 font-semibold">{session.initial_meter_reading ?? '—'} → {session.final_meter_reading ?? '—'}</dd>
                  </div>
                )}
                {session.calculation_method === 'TIME_BASED' && session.compatible_power_kw != null && (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <dt className="text-sm text-slate-500">Estimated average input power</dt>
                    <dd className="mt-1 font-semibold">
                      {session.estimated_average_power_kw ?? '—'} kW
                      <span className="block text-xs font-normal text-slate-500">
                        Compatible power {session.compatible_power_kw} kW × {session.average_power_factor} factor
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
              <section className="mt-6 rounded-2xl border border-slate-200 p-5">
                <h2 className="font-semibold">Session event history</h2>
                {sessionEvents.length ? (
                  <ol className="mt-3 space-y-2">
                    {sessionEvents.map((event, index) => (
                      <li className="flex flex-wrap justify-between gap-2 text-sm" key={`${event.recorded_at}-${index}`}>
                        <span className="font-medium">{event.event_type === 'CHARGING' ? 'Charging started' : event.event_type === 'PAUSED' ? 'Charging paused' : event.event_type === 'RESUMED' ? 'Charging resumed' : 'Charging ended'}</span>
                        <time className="text-slate-600" dateTime={event.recorded_at}>{new Date(event.recorded_at).toLocaleString()}</time>
                      </li>
                    ))}
                  </ol>
                ) : <p className="mt-2 text-sm text-slate-600">No charging events recorded yet.</p>}
              </section>

              {canControl && session.status === 'AWAITING_METHOD' && !session.method_confirmed_by_owner && isOwner && (
                <form className="mt-6 rounded-2xl border border-slate-200 p-5" onSubmit={(event) => void performAction(event, 'confirm-method')}>
                  <h2 className="font-semibold">Confirm provider-approved calculation</h2>
                  {session.provider_approved_at && session.calculation_method ? (
                    <>
                      <p className="mt-2 text-sm text-slate-700">
                        {session.calculation_method === 'METER_BASED'
                          ? 'ACTUAL — Dedicated EV meter readings will determine energy consumption.'
                          : 'ESTIMATED — Charging time and compatible input power will estimate energy consumption.'}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">Agreed rate: ₹{booking?.price_per_kwh_snapshot}/kWh. This method cannot be changed after charging begins.</p>
                      <button className="mt-4 rounded-full bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">Confirm agreed method</button>
                    </>
                  ) : <p className="mt-2 text-sm text-slate-600">Waiting for the provider to select and approve a calculation method.</p>}
                </form>
              )}

              {canControl && isProvider && session.status === 'AWAITING_METHOD' && session.method_confirmed_by_owner && session.calculation_method === 'METER_BASED' && (
                <form className="mt-6 rounded-2xl border border-slate-200 p-5" onSubmit={(event) => void performAction(event, 'start-meter')}>
                  <h2 className="font-semibold">Start actual meter-based session</h2>
                  <p className="mt-2 text-sm text-slate-600">Use the dedicated EV charger meter only. Whole-house readings that include other appliances are not valid.</p>
                  <label className="mt-4 flex flex-col gap-2 text-sm font-medium">
                    Initial meter reading (kWh)
                    <input className="rounded-xl border border-slate-300 px-4 py-3" min="0" onChange={(event) => setInitialReading(event.target.value)} required step="any" type="number" value={initialReading} />
                  </label>
                  <button className="mt-4 rounded-full bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">Start charging</button>
                </form>
              )}

              {canControl && isOwner && session.status === 'AWAITING_METHOD' && session.method_confirmed_by_owner && session.calculation_method === 'TIME_BASED' && (
                <form className="mt-6 rounded-2xl border border-slate-200 p-5" onSubmit={(event) => void performAction(event, 'start-time')}>
                  <h2 className="font-semibold">Start estimated time-based session</h2>
                  <p className="mt-2 text-sm text-slate-600">The server uses the lowest known charger, vehicle, and site power limit, multiplied by the average power factor. This is an estimate, not a meter measurement; actual charging can differ due to vehicle and supply conditions.</p>
                  <button className="mt-4 rounded-full bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">Start charging</button>
                </form>
              )}

              {canControl && isProvider && ['CHARGING', 'PAUSED'].includes(session.status) && session.calculation_method === 'METER_BASED' && (
                <form className="mt-6 rounded-2xl border border-slate-200 p-5" onSubmit={(event) => void performAction(event, 'stop-meter')}>
                  <h2 className="font-semibold">Finalize ACTUAL meter-based consumption</h2>
                  <label className="mt-4 flex flex-col gap-2 text-sm font-medium">
                    Final meter reading (kWh)
                    <input className="rounded-xl border border-slate-300 px-4 py-3" min={session.initial_meter_reading ?? 0} onChange={(event) => setFinalReading(event.target.value)} required step="any" type="number" value={finalReading} />
                  </label>
                  <button className="mt-4 rounded-full bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">Stop session</button>
                </form>
              )}

              {canControl && ['CHARGING', 'PAUSED'].includes(session.status) && session.calculation_method === 'TIME_BASED' && (
                <form className="mt-6 rounded-2xl border border-slate-200 p-5" onSubmit={(event) => void performAction(event, 'stop-time')}>
                  <h2 className="font-semibold">Finalize ESTIMATED time-based consumption</h2>
                  <p className="mt-2 text-sm text-slate-600">Paused time is excluded. Estimate = server-calculated average input power × active duration. It does not apply an additional charging-efficiency adjustment.</p>
                  <button className="mt-4 rounded-full bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">Stop session</button>
                </form>
              )}
              {canControl && ['CHARGING', 'PAUSED'].includes(session.status) && (
                <div className="mt-4 flex gap-3">
                  {session.status === 'CHARGING' ? (
                    <button className="rounded-full border border-slate-300 px-5 py-3 font-semibold disabled:opacity-60" disabled={saving} onClick={(event) => void performAction(event, 'pause')} type="button">Pause charging</button>
                  ) : (
                    <button className="rounded-full border border-slate-300 px-5 py-3 font-semibold disabled:opacity-60" disabled={saving} onClick={(event) => void performAction(event, 'resume')} type="button">Resume charging</button>
                  )}
                </div>
              )}
              {!canControl && <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">You can view this session but do not have permission to control it.</p>}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
