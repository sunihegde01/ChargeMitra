import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase'

type Provider = { id: string; business_name: string; category: string; address: string | null; verified: boolean }
type Charger = { id: string; name: string; charger_type: string; rated_power_kw: number; price_per_kwh: number; is_active: boolean }
type Booking = { id: string; charger_id: string; status: string; scheduled_start: string; scheduled_end: string; price_per_kwh_snapshot: number }
type SessionLink = { id: string; booking_id: string }

export default function ProviderDashboard() {
  const { user, signOut } = useAuth()
  const [provider, setProvider] = useState<Provider | null>(null)
  const [chargers, setChargers] = useState<Charger[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [sessionsByBooking, setSessionsByBooking] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingBookingId, setSavingBookingId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const loadDashboard = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setErrorMessage('')
    const { data: providerRow, error: providerError } = await supabase
      .from('providers')
      .select('id,business_name,category,address,verified')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (providerError) {
      setErrorMessage(providerError.message)
      setLoading(false)
      return
    }
    if (!providerRow) {
      setProvider(null)
      setChargers([])
      setBookings([])
      setLoading(false)
      return
    }
    setProvider(providerRow)

    const [chargerResult, bookingResult] = await Promise.all([
      supabase.from('chargers').select('id,name,charger_type,rated_power_kw,price_per_kwh,is_active').eq('provider_id', providerRow.id).order('created_at', { ascending: false }),
      supabase.from('bookings').select('id,charger_id,status,scheduled_start,scheduled_end,price_per_kwh_snapshot').eq('provider_id', providerRow.id).order('created_at', { ascending: false }),
    ])
    if (chargerResult.error || bookingResult.error) {
      setErrorMessage(chargerResult.error?.message ?? bookingResult.error?.message ?? 'Could not load provider data.')
    } else {
      setChargers(chargerResult.data ?? [])
      setBookings(bookingResult.data ?? [])
      const bookingIds = (bookingResult.data ?? []).map((booking) => booking.id)
      if (bookingIds.length) {
        const { data: sessionRows, error } = await supabase
          .from('charging_sessions')
          .select('id,booking_id')
          .in('booking_id', bookingIds)
        if (error) setErrorMessage(error.message)
        else {
          setSessionsByBooking(Object.fromEntries(
            ((sessionRows ?? []) as SessionLink[]).map((session) => [session.booking_id, session.id]),
          ))
        }
      } else {
        setSessionsByBooking({})
      }
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  async function updateBookingStatus(bookingId: string, status: 'ACCEPTED' | 'DECLINED') {
    setSavingBookingId(bookingId)
    setErrorMessage('')
    setSuccessMessage('')
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)
      .eq('status', 'PENDING')
    if (error) {
      setErrorMessage(error.message)
    } else {
      setSuccessMessage(`Booking ${status.toLowerCase()}.`)
      await loadDashboard()
    }
    setSavingBookingId('')
  }

  return (
    <main className="min-h-screen bg-[#f7f9f6] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link className="text-sm font-semibold text-emerald-700" to="/">ChargeMitra</Link>
            <h1 className="mt-3 text-3xl font-semibold">Provider dashboard</h1>
            <p className="mt-1 text-slate-600">Manage your stations and review booking requests.</p>
          </div>
          <div className="flex gap-3">
            <Link className="rounded-full bg-emerald-700 px-5 py-3 font-semibold text-white" to="/provider/chargers/new">Add a charger</Link>
            <button className="rounded-full border border-slate-300 px-5 py-3 font-semibold" onClick={() => void signOut()}>Sign out</button>
          </div>
        </header>

        {errorMessage && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-800" role="alert">{errorMessage}</p>}
        {successMessage && <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-800" role="status">{successMessage}</p>}
        {loading ? <p className="mt-8 text-slate-600">Loading provider dashboard...</p> : !provider ? (
          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7">
            <h2 className="text-xl font-semibold">Set up your provider profile</h2>
            <p className="mt-2 text-slate-600">Create your first charger listing to register your provider business.</p>
            <Link className="mt-5 inline-flex rounded-full bg-emerald-700 px-5 py-3 font-semibold text-white" to="/provider/chargers/new">Set up provider</Link>
          </section>
        ) : (
          <>
            <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Provider profile</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">{provider.business_name}</h2>
                  <p className="mt-1 text-slate-600">{provider.category}{provider.address ? ` · ${provider.address}` : ''}</p>
                </div>
                <span className={`rounded-full px-4 py-2 text-sm font-semibold ${provider.verified ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                  {provider.verified ? 'Verified' : 'Verification pending'}
                </span>
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-semibold">Your chargers</h2>
                {chargers.length ? <ul className="mt-4 divide-y divide-slate-100">
                  {chargers.map((charger) => (
                    <li className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0" key={charger.id}>
                      <div>
                        <p className="font-semibold">{charger.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{charger.charger_type} · {charger.rated_power_kw} kW · ₹{charger.price_per_kwh}/kWh</p>
                      </div>
                      <span className={`text-sm font-medium ${charger.is_active ? 'text-emerald-700' : 'text-slate-500'}`}>{charger.is_active ? 'Active' : 'Inactive'}</span>
                    </li>
                  ))}
                </ul> : <p className="mt-4 text-slate-600">No chargers listed yet.</p>}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-semibold">Booking requests</h2>
                {bookings.length ? <ul className="mt-4 divide-y divide-slate-100">
                  {bookings.map((booking) => (
                    <li className="py-4 first:pt-0 last:pb-0" key={booking.id}>
                      <p className="font-semibold">{chargers.find((charger) => charger.id === booking.charger_id)?.name ?? 'Charger booking'}</p>
                      <p className="mt-1 text-sm text-slate-600">{new Date(booking.scheduled_start).toLocaleString()}</p>
                      <p className="mt-1 text-sm text-slate-600">{booking.status} · ₹{booking.price_per_kwh_snapshot}/kWh</p>
                      {sessionsByBooking[booking.id] && (
                        <Link className="mt-2 inline-flex text-sm font-semibold text-emerald-700 underline" to={`/session/${sessionsByBooking[booking.id]}`}>Open charging session</Link>
                      )}
                      {booking.status === 'PENDING' && (
                        <div className="mt-3 flex gap-2">
                          <button className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={savingBookingId === booking.id} onClick={() => void updateBookingStatus(booking.id, 'ACCEPTED')} type="button">Accept</button>
                          <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={savingBookingId === booking.id} onClick={() => void updateBookingStatus(booking.id, 'DECLINED')} type="button">Decline</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul> : <p className="mt-4 text-slate-600">No booking requests yet.</p>}
              </div>
            </section>
            <p className="mt-5 text-sm text-slate-500">If booking status updates are rejected, run the supplied <code>supabase-fix.sql</code> in the Supabase SQL Editor to add the restricted provider status policy.</p>
          </>
        )}
      </div>
    </main>
  )
}
