import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChargerMap } from '../../components/ChargerMap'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase'

type Provider = {
  id: string
  business_name: string
  address: string | null
  location: unknown
}

type Charger = {
  id: string
  provider_id: string
  name: string
  charger_type: string
  rated_power_kw: number
  connector_type: string
  price_per_kwh: number
}

type Vehicle = { id: string; brand: string; model: string }
type Point = { lat: number; lng: number }

const fieldClass = 'rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15'

function parsePoint(location: unknown): Point | null {
  if (typeof location === 'string') {
    const point = location.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i)
    if (point) return { lng: Number(point[1]), lat: Number(point[2]) }
    try {
      return parsePoint(JSON.parse(location) as unknown)
    } catch {
      return null
    }
  }
  if (typeof location === 'object' && location !== null && 'coordinates' in location) {
    const coordinates = location.coordinates
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      const [lng, lat] = coordinates
      if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng }
    }
  }
  return null
}

export default function FindChargerPage() {
  const { user } = useAuth()
  const [chargers, setChargers] = useState<Charger[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchCenter, setSearchCenter] = useState<Point>({ lat: 20.5937, lng: 78.9629 })
  const [vehicleId, setVehicleId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [savingId, setSavingId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const loadChargers = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setErrorMessage('')
    const [chargerResult, providerResult, vehicleResult] = await Promise.all([
      supabase.from('chargers').select('id,provider_id,name,charger_type,rated_power_kw,connector_type,price_per_kwh').eq('is_active', true),
      supabase.from('providers').select('id,business_name,address,location'),
      supabase.from('vehicles').select('id,brand,model').eq('owner_id', user.id),
    ])

    const firstError = chargerResult.error ?? providerResult.error ?? vehicleResult.error
    if (firstError) {
      setErrorMessage(firstError.message)
      setLoading(false)
      return
    }
    setChargers(chargerResult.data ?? [])
    setProviders((providerResult.data ?? []) as Provider[])
    setVehicles(vehicleResult.data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    void loadChargers()
  }, [loadChargers])

  const visibleChargers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return chargers
    return chargers.filter((charger) => {
      const provider = providers.find((item) => item.id === charger.provider_id)
      return [charger.name, charger.charger_type, charger.connector_type, provider?.business_name, provider?.address]
        .some((value) => value?.toLowerCase().includes(term))
    })
  }, [chargers, providers, search])

  const pins = useMemo(() => visibleChargers.flatMap((charger) => {
    const provider = providers.find((item) => item.id === charger.provider_id)
    const point = provider ? parsePoint(provider.location) : null
    return point ? [{
      id: charger.id,
      lat: point.lat,
      lng: point.lng,
      name: charger.name,
      pricePerKwh: Number(charger.price_per_kwh),
    }] : []
  }), [providers, visibleChargers])

  async function searchAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const term = search.trim()
    if (!term) return
    setErrorMessage('')
    try {
      const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&limit=1`)
      if (!response.ok) throw new Error(`Address search failed (${response.status}).`)
      const result = await response.json() as {
        features?: Array<{ geometry?: { coordinates?: unknown[] } }>
      }
      const coordinates = result.features?.[0]?.geometry?.coordinates
      if (!coordinates || typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') {
        setErrorMessage('No matching address found. Try a nearby street or area.')
        return
      }
      setSearchCenter({ lng: coordinates[0], lat: coordinates[1] })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Address search failed.')
    }
  }

  async function bookCharger(event: FormEvent<HTMLFormElement>, charger: Charger) {
    event.preventDefault()
    if (!user || !vehicleId) {
      setErrorMessage('Add a vehicle on your dashboard before booking.')
      return
    }
    const start = new Date(startsAt)
    const end = new Date(endsAt)
    if (!startsAt || !endsAt || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setErrorMessage('Choose a valid start and end time.')
      return
    }

    setSavingId(charger.id)
    setErrorMessage('')
    setSuccessMessage('')
    const { error } = await supabase.from('bookings').insert({
      owner_id: user.id,
      vehicle_id: vehicleId,
      charger_id: charger.id,
      provider_id: charger.provider_id,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      price_per_kwh_snapshot: charger.price_per_kwh,
    })

    if (error) setErrorMessage(error.message)
    else setSuccessMessage(`Booking request sent to ${charger.name}.`)
    setSavingId('')
  }

  return (
    <main className="min-h-screen bg-[#f7f9f6] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link className="text-sm font-semibold text-emerald-700" to="/owner/dashboard">← Owner dashboard</Link>
            <h1 className="mt-3 text-3xl font-semibold">Find a charger</h1>
            <p className="mt-1 text-slate-600">Search stations, compare rates, and request a booking.</p>
          </div>
        </header>

        <form className="mt-7 flex flex-col gap-3 sm:flex-row" onSubmit={searchAddress}>
          <input className={`${fieldClass} min-w-0 flex-1`} onChange={(event) => setSearch(event.target.value)} placeholder="Search station, connector, or address" value={search} />
          <button className="rounded-full bg-slate-900 px-6 py-3 font-semibold text-white" type="submit">Search address</button>
        </form>

        {errorMessage && <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-800" role="alert">{errorMessage}</p>}
        {successMessage && <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-emerald-800" role="status">{successMessage}</p>}

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white p-2">
          <ChargerMap chargers={pins} center={searchCenter} key={`${searchCenter.lat},${searchCenter.lng}`} />
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-xl font-semibold">Available stations</h2>
            {!vehicles.length && !loading && <Link className="text-sm font-semibold text-emerald-700 underline" to="/owner/dashboard">Add a vehicle to book</Link>}
          </div>
          {loading ? <p className="text-slate-600">Loading stations...</p> : visibleChargers.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {visibleChargers.map((charger) => {
                const provider = providers.find((item) => item.id === charger.provider_id)
                return (
                  <article className="rounded-3xl border border-slate-200 bg-white p-6" key={charger.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{charger.charger_type} charger · {charger.rated_power_kw} kW</p>
                        <h3 className="mt-2 text-xl font-semibold">{charger.name}</h3>
                        <p className="mt-1 text-slate-600">{provider?.business_name ?? 'Charging provider'}{provider?.address ? ` · ${provider.address}` : ''}</p>
                        <p className="mt-2 text-sm text-slate-600">Connector: {charger.connector_type}</p>
                      </div>
                      <p className="rounded-full bg-emerald-50 px-4 py-2 font-semibold text-emerald-800">₹{charger.price_per_kwh}/kWh</p>
                    </div>
                    <form className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2" onSubmit={(event) => void bookCharger(event, charger)}>
                      <select aria-label="Select vehicle" className={fieldClass} onChange={(event) => setVehicleId(event.target.value)} required value={vehicleId}>
                        <option value="">Select vehicle</option>
                        {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model}</option>)}
                      </select>
                      <input aria-label="Booking start" className={fieldClass} onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} />
                      <input aria-label="Booking end" className={fieldClass} onChange={(event) => setEndsAt(event.target.value)} required type="datetime-local" value={endsAt} />
                      <button className="rounded-full bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60" disabled={!vehicles.length || savingId === charger.id} type="submit">
                        {savingId === charger.id ? 'Requesting...' : 'Request booking'}
                      </button>
                    </form>
                  </article>
                )
              })}
            </div>
          ) : <p className="rounded-2xl bg-white p-6 text-slate-600">{search ? 'No matching charging stations found.' : 'No active charging stations are listed yet.'}</p>}
        </section>
      </div>
    </main>
  )
}
