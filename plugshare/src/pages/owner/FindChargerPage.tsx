import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChargerMap } from '../../components/ChargerMap'
import { useAuth } from '../../context/AuthContext'
import { parsePoint, type Point } from '../../location'
import { getDefaultVehicleId, setDefaultVehicleId } from '../../vehiclePreference'
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
const fieldClass = 'rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15'

function distanceInKm(from: Point, to: Point): number {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDifference = radians(to.lat - from.lat)
  const longitudeDifference = radians(to.lng - from.lng)
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(longitudeDifference / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export default function FindChargerPage() {
  const { user } = useAuth()
  const [chargers, setChargers] = useState<Charger[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addressSearch, setAddressSearch] = useState('')
  const [searchCenter, setSearchCenter] = useState<Point>({ lat: 20.5937, lng: 78.9629 })
  const [distanceOrigin, setDistanceOrigin] = useState<Point | null>(null)
  const [userLocation, setUserLocation] = useState<Point | null>(null)
  const [locating, setLocating] = useState(false)
  const [selectedChargerId, setSelectedChargerId] = useState('')
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
    const vehicleRows = vehicleResult.data ?? []
    setVehicles(vehicleRows)
    const savedVehicleId = getDefaultVehicleId(user.id)
    const nextDefaultVehicleId = vehicleRows.some((vehicle) => vehicle.id === savedVehicleId)
      ? savedVehicleId
      : vehicleRows[0]?.id ?? ''
    setVehicleId(nextDefaultVehicleId)
    if (nextDefaultVehicleId && savedVehicleId !== nextDefaultVehicleId) {
      setDefaultVehicleId(user.id, nextDefaultVehicleId)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    void loadChargers()
  }, [loadChargers])

  const visibleChargers = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matchesSearch = term ? chargers.filter((charger) => {
      const provider = providers.find((item) => item.id === charger.provider_id)
      return [charger.name, charger.charger_type, charger.connector_type, provider?.business_name, provider?.address]
        .some((value) => value?.toLowerCase().includes(term))
    }) : chargers
    return matchesSearch.map((charger) => {
      const provider = providers.find((item) => item.id === charger.provider_id)
      const point = provider ? parsePoint(provider.location) : null
      return { charger, point, distance: point && distanceOrigin ? distanceInKm(distanceOrigin, point) : null }
    }).sort((first, second) => distanceOrigin
      ? (first.distance ?? Number.POSITIVE_INFINITY) - (second.distance ?? Number.POSITIVE_INFINITY)
      : 0)
  }, [chargers, providers, search, distanceOrigin])

  const mappedChargers = useMemo(() => visibleChargers.flatMap(({ charger, point, distance }) => point ? [{
    charger,
    point,
    distance,
  }] : []), [visibleChargers])
  const nearbyChargers = useMemo(() => mappedChargers.slice(0, 10), [mappedChargers])
  const pins = useMemo(() => nearbyChargers.map(({ charger, point, distance }) => ({
      id: charger.id,
      lat: point.lat,
      lng: point.lng,
      name: charger.name,
      pricePerKwh: Number(charger.price_per_kwh),
      distanceKm: distance,
    })), [nearbyChargers])
  const nearestMappedChargerId = distanceOrigin ? nearbyChargers[0]?.charger.id : undefined
  const selectedCharger = nearbyChargers.find(({ charger }) => charger.id === selectedChargerId)

  async function searchAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const term = addressSearch.trim()
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
      const point = { lng: coordinates[0], lat: coordinates[1] }
      setSearchCenter(point)
      setDistanceOrigin(point)
      setUserLocation(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Address search failed.')
    }
  }

  function useMyLocation() {
    setErrorMessage('')
    setSuccessMessage('')
    if (!navigator.geolocation) {
      setErrorMessage('Location access is not supported by this browser.')
      return
    }
    if (!window.isSecureContext) {
      setErrorMessage('Location access requires a secure connection. Open this site on localhost or HTTPS.')
      return
    }

    setLocating(true)
    try {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const point = { lat: coords.latitude, lng: coords.longitude }
          if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)
            || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) {
            setErrorMessage('Your browser returned an invalid location. Try again or search for an address.')
            setLocating(false)
            return
          }
          setSearchCenter(point)
          setDistanceOrigin(point)
          setUserLocation(point)
          setSearch('')
          setSuccessMessage('Your location is selected. Nearby charging points are sorted by distance.')
          setLocating(false)
        },
        (error) => {
          const message = error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Allow location access for this site in your browser settings, then try again.'
            : error.code === error.TIMEOUT
              ? 'Finding your location timed out. Check device location services and try again.'
              : 'Your location is unavailable. Check device location services or search for an address.'
          setErrorMessage(message)
          setLocating(false)
        },
        { enableHighAccuracy: false, timeout: 30000, maximumAge: 120000 },
      )
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not start location access. Check this site's browser permissions.")
      setLocating(false)
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
    if (!startsAt || !endsAt || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start <= new Date() || end <= start) {
      setErrorMessage('Choose a future start time and an end time after it.')
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

    if (error?.code === '23P01' || error?.message.includes('no_overlap')) {
      setErrorMessage('This charger is already booked for part or all of that time. Choose another time slot or charger.')
    } else if (error) {
      setErrorMessage(error.message)
    } else {
      setSuccessMessage(`Booking request sent to ${charger.name}.`)
    }
    setSavingId('')
  }

  const selectedChargerDetails = selectedCharger
    ? {
        ...selectedCharger,
        provider: providers.find((item) => item.id === selectedCharger.charger.provider_id),
      }
    : null

  return (
    <main className="min-h-screen bg-[#f7f9f6] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link className="text-sm font-semibold text-emerald-700" to="/owner/dashboard">← User dashboard</Link>
            <h1 className="mt-3 text-3xl font-semibold">Find a charger</h1>
            <p className="mt-1 text-slate-600">Search stations, compare rates, and request a booking.</p>
          </div>
        </header>

        <div className="mt-7 grid gap-3">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={searchAddress}>
            <input
              aria-label="Search map area"
              className={`${fieldClass} min-w-0 flex-1`}
              onChange={(event) => setAddressSearch(event.target.value)}
              placeholder="Enter an area or address to center the map"
              value={addressSearch}
            />
            <button className="rounded-full bg-slate-900 px-6 py-3 font-semibold text-white" type="submit">Search area</button>
            <button className="rounded-full border border-emerald-700 px-6 py-3 font-semibold text-emerald-800 disabled:cursor-wait disabled:opacity-60" disabled={locating} onClick={useMyLocation} type="button">
              {locating ? 'Finding you...' : 'Use my location'}
            </button>
          </form>
          <input
            aria-label="Filter charging points"
            className={fieldClass}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter charging points by station, connector, or host"
            value={search}
          />
        </div>

        {errorMessage && <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-800" role="alert">{errorMessage}</p>}
        {successMessage && <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-emerald-800" role="status">{successMessage}</p>}

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white p-2">
          <ChargerMap
            chargers={pins}
            center={searchCenter}
            nearestChargerId={nearestMappedChargerId}
            onChargerSelect={setSelectedChargerId}
            selectedChargerId={selectedChargerId}
            userLocation={userLocation}
            key={`${searchCenter.lat},${searchCenter.lng}`}
          />
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">Choose a charging point on the map</h2>
              <p className="mt-1 text-sm text-slate-600">
                {distanceOrigin
                  ? `Showing the nearest ${nearbyChargers.length} mapped charging points to your selected location. Select a map pin to view its booking form.`
                  : 'Use my location or search for an area to see accurate distances and sort nearby points. Select a map pin to view its booking form.'}
              </p>
            </div>
            {!vehicles.length && !loading && <Link className="text-sm font-semibold text-emerald-700 underline" to="/owner/dashboard">Add a vehicle to book</Link>}
          </div>
          {loading ? <p className="text-slate-600">Loading stations...</p> : !nearbyChargers.length ? (
            <p className="rounded-2xl bg-white p-6 text-slate-600" role="status">
              {search ? 'No mapped charging points match your filter.' : chargers.length ? 'No active charging points have a map location yet.' : 'No active chargers found.'}
            </p>
          ) : selectedChargerDetails ? (
            <article className="rounded-3xl border border-emerald-500 bg-white p-6 ring-2 ring-emerald-100">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {selectedChargerDetails.charger.id === nearestMappedChargerId && <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Nearest charging point</p>}
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{selectedChargerDetails.charger.charger_type} charger · {selectedChargerDetails.charger.rated_power_kw} kW</p>
                  <h3 className="mt-2 text-xl font-semibold">{selectedChargerDetails.charger.name}</h3>
                  <p className="mt-1 text-slate-600">{selectedChargerDetails.provider?.business_name ?? 'Charging provider'}{selectedChargerDetails.provider?.address ? ` · ${selectedChargerDetails.provider.address}` : ''}</p>
                  <p className="mt-2 text-sm font-medium text-emerald-800">
                    {selectedChargerDetails.distance === null
                      ? 'Choose your location to calculate distance'
                      : `${selectedChargerDetails.distance.toFixed(1)} km away`}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">Connector: {selectedChargerDetails.charger.connector_type}</p>
                </div>
                <p className="rounded-full bg-emerald-50 px-4 py-2 font-semibold text-emerald-800">₹{selectedChargerDetails.charger.price_per_kwh}/kWh</p>
              </div>
              <button className="mt-4 text-sm font-semibold text-emerald-700 underline" onClick={() => setSelectedChargerId('')} type="button">Choose a different map pin</button>
              <form className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2" onSubmit={(event) => void bookCharger(event, selectedChargerDetails.charger)}>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Start date and time
                  <span className="text-xs font-normal text-slate-500">When you want the charging session to begin.</span>
                  <input aria-label="Start date and time" className={fieldClass} onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  End date and time
                  <span className="text-xs font-normal text-slate-500">When you expect the charging session to finish.</span>
                  <input aria-label="End date and time" className={fieldClass} onChange={(event) => setEndsAt(event.target.value)} required type="datetime-local" value={endsAt} />
                </label>
                <button className="rounded-full bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60" disabled={!vehicles.length || savingId === selectedChargerDetails.charger.id} type="submit">
                  {savingId === selectedChargerDetails.charger.id ? 'Requesting...' : 'Request booking'}
                </button>
              </form>
            </article>
          ) : (
            <p className="rounded-2xl bg-white p-6 text-slate-600" role="status">
              Select a charging-point pin on the map to see its details and request a booking.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
