import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase'

type Vehicle = {
  id: string
  brand: string
  model: string
  variant: string | null
  usable_battery_kwh: number
  connector_types: string[]
}

type Booking = {
  id: string
  status: string
  scheduled_start: string
  scheduled_end: string
  price_per_kwh_snapshot: number
  charger_id: string
}

type Charger = { id: string; name: string }
type SessionLink = { id: string; booking_id: string }

const fieldClass = 'w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15'

export default function OwnerDashboard() {
  const { user, signOut } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [chargers, setChargers] = useState<Charger[]>([])
  const [sessionsByBooking, setSessionsByBooking] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [battery, setBattery] = useState('')
  const [maxAc, setMaxAc] = useState('')
  const [maxDc, setMaxDc] = useState('')
  const [connectors, setConnectors] = useState('Type 2, CCS2')

  const loadDashboard = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setErrorMessage('')

    const [vehiclesResult, bookingsResult] = await Promise.all([
      supabase
        .from('vehicles')
        .select('id,brand,model,variant,usable_battery_kwh,connector_types')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('bookings')
        .select('id,status,scheduled_start,scheduled_end,price_per_kwh_snapshot,charger_id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (vehiclesResult.error || bookingsResult.error) {
      setErrorMessage(
        vehiclesResult.error?.message ?? bookingsResult.error?.message ?? 'Could not load your dashboard.',
      )
      setLoading(false)
      return
    }

    const vehicleRows = vehiclesResult.data ?? []
    const bookingRows = bookingsResult.data ?? []
    setVehicles(vehicleRows)
    setBookings(bookingRows)

    const bookingIds = bookingRows.map((booking) => booking.id)
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

    const chargerIds = [...new Set(bookingRows.map((booking) => booking.charger_id))]
    if (chargerIds.length) {
      const { data: chargerRows, error } = await supabase
        .from('chargers')
        .select('id,name')
        .in('id', chargerIds)
      if (error) setErrorMessage(error.message)
      else setChargers(chargerRows ?? [])
    } else {
      setChargers([])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  async function addVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setSaving(true)
    setErrorMessage('')
    setSuccessMessage('')

    const { error } = await supabase.from('vehicles').insert({
      owner_id: user.id,
      brand,
      model,
      usable_battery_kwh: Number(battery),
      max_ac_kw: Number(maxAc),
      max_dc_kw: Number(maxDc),
      connector_types: connectors.split(',').map((connector) => connector.trim()).filter(Boolean),
    })

    if (error) {
      setErrorMessage(error.message)
    } else {
      setBrand('')
      setModel('')
      setBattery('')
      setMaxAc('')
      setMaxDc('')
      setSuccessMessage('Vehicle added.')
      await loadDashboard()
    }
    setSaving(false)
  }

  return (
    <main className="min-h-screen bg-[#f7f9f6] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link className="text-sm font-semibold text-emerald-700" to="/">ChargeMitra</Link>
            <h1 className="mt-3 text-3xl font-semibold">Owner dashboard</h1>
            <p className="mt-1 text-slate-600">Manage your vehicles and charging bookings.</p>
          </div>
          <div className="flex gap-3">
            <Link className="rounded-full bg-emerald-700 px-5 py-3 font-semibold text-white" to="/owner/find">Find a charger</Link>
            <button className="rounded-full border border-slate-300 px-5 py-3 font-semibold" onClick={() => void signOut()}>Sign out</button>
          </div>
        </header>

        {errorMessage && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-800" role="alert">{errorMessage}</p>}
        {successMessage && <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-800" role="status">{successMessage}</p>}

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Your vehicles</h2>
            {loading ? <p className="mt-4 text-slate-600">Loading vehicles...</p> : vehicles.length ? (
              <ul className="mt-4 divide-y divide-slate-100">
                {vehicles.map((vehicle) => (
                  <li className="py-4 first:pt-0 last:pb-0" key={vehicle.id}>
                    <p className="font-semibold">{vehicle.brand} {vehicle.model}{vehicle.variant ? ` · ${vehicle.variant}` : ''}</p>
                    <p className="mt-1 text-sm text-slate-600">{vehicle.usable_battery_kwh} kWh · {vehicle.connector_types.join(', ')}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-slate-600">Add a vehicle to start booking chargers.</p>}

            <form className="mt-6 grid gap-3 border-t border-slate-100 pt-6 sm:grid-cols-2" onSubmit={addVehicle}>
              <h3 className="font-semibold sm:col-span-2">Add a vehicle</h3>
              <input aria-label="Vehicle brand" className={fieldClass} placeholder="Brand" required value={brand} onChange={(event) => setBrand(event.target.value)} />
              <input aria-label="Vehicle model" className={fieldClass} placeholder="Model" required value={model} onChange={(event) => setModel(event.target.value)} />
              <input aria-label="Usable battery in kWh" className={fieldClass} min="0.1" placeholder="Battery (kWh)" required type="number" step="0.1" value={battery} onChange={(event) => setBattery(event.target.value)} />
              <input aria-label="Maximum AC power in kW" className={fieldClass} min="0.1" placeholder="Max AC (kW)" required type="number" step="0.1" value={maxAc} onChange={(event) => setMaxAc(event.target.value)} />
              <input aria-label="Maximum DC power in kW" className={fieldClass} min="0.1" placeholder="Max DC (kW)" required type="number" step="0.1" value={maxDc} onChange={(event) => setMaxDc(event.target.value)} />
              <input aria-label="Connector types, separated by commas" className={fieldClass} placeholder="Connectors, comma separated" required value={connectors} onChange={(event) => setConnectors(event.target.value)} />
              <button className="rounded-full bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-60 sm:col-span-2" disabled={saving} type="submit">{saving ? 'Saving...' : 'Add vehicle'}</button>
            </form>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Your bookings</h2>
            {loading ? <p className="mt-4 text-slate-600">Loading bookings...</p> : bookings.length ? (
              <ul className="mt-4 divide-y divide-slate-100">
                {bookings.map((booking) => (
                  <li className="py-4 first:pt-0 last:pb-0" key={booking.id}>
                    <p className="font-semibold">{chargers.find((charger) => charger.id === booking.charger_id)?.name ?? 'Charger booking'}</p>
                    <p className="mt-1 text-sm text-slate-600">{new Date(booking.scheduled_start).toLocaleString()} · {booking.status}</p>
                    <p className="mt-1 text-sm text-slate-600">₹{booking.price_per_kwh_snapshot}/kWh</p>
                    {sessionsByBooking[booking.id] && (
                      <Link className="mt-2 inline-flex text-sm font-semibold text-emerald-700 underline" to={`/session/${sessionsByBooking[booking.id]}`}>Open charging session</Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-slate-600">Your upcoming bookings will appear here.</p>}
          </div>
        </section>
      </div>
    </main>
  )
}
