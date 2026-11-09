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
type RoadDistanceResponse = {
  code?: string
  distances?: Array<Array<number | null>>
}
const fieldClass = 'rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15'

function formatRoadDistance(distanceMeters: number): string {
  return distanceMeters < 1000
    ? `${Math.round(distanceMeters)} m`
    : `${(distanceMeters / 1000).toFixed(1)} km`
}

export default function FindChargerPage() {
  const { user } = useAuth()
  const [chargers, setChargers] = useState<Charger[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchCenter, setSearchCenter] = useState<Point>({ lat: 20.5937, lng: 78.9629 })
  const [distanceOrigin, setDistanceOrigin] = useState<Point | null>(null)
  const [userLocation, setUserLocation] = useState<Point | null>(null)
  const [roadDistances, setRoadDistances] = useState<Record<string, number | null>>({})
  const [roadDistanceStatus, setRoadDistanceStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [pickingLocation, setPickingLocation] = useState(false)
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

  useEffect(() => {
    if (!distanceOrigin) {
      setRoadDistances({})
      setRoadDistanceStatus('idle')
      return
    }
    const origin = distanceOrigin

    const destinationsByProvider = new Map<string, Point>()
    for (const provider of providers) {
      const point = parsePoint(provider.location)
      if (point) destinationsByProvider.set(provider.id, point)
    }
    const destinations = [...destinationsByProvider.entries()]
    if (!destinations.length) {
      setRoadDistances({})
      setRoadDistanceStatus('ready')
      return
    }

    const controller = new AbortController()
    async function loadRoadDistances() {
      setRoadDistances({})
      setRoadDistanceStatus('loading')
      setErrorMessage('')
      const nextDistances: Record<string, number | null> = {}

      try {
        for (let start = 0; start < destinations.length; start += 50) {
          const batch = destinations.slice(start, start + 50)
          const coordinates = [
            `${origin.lng},${origin.lat}`,
            ...batch.map(([, point]) => `${point.lng},${point.lat}`),
          ].join(';')
          const destinationIndexes = batch.map((_, index) => index + 1).join(';')
          const response = await fetch(
            `https://router.project-osrm.org/table/v1/driving/${coordinates}?sources=0&destinations=${destinationIndexes}&annotations=distance`,
            { signal: controller.signal },
          )
          if (!response.ok) throw new Error(`Driving-distance lookup failed (${response.status}).`)
          const result = await response.json() as RoadDistanceResponse
          const row = result.distances?.[0]
          if (result.code !== 'Ok' || !row || row.length !== batch.length) {
            throw new Error('Could not calculate driving distances for the charging points.')
          }
          batch.forEach(([providerId], index) => {
            nextDistances[providerId] = row[index]
          })
        }

        if (!controller.signal.aborted) {
          setRoadDistances(nextDistances)
          setRoadDistanceStatus('ready')
        }
      } catch (error) {
        if (controller.signal.aborted) return
        setRoadDistanceStatus('error')
        setErrorMessage(error instanceof Error ? error.message : 'Could not calculate driving distances.')
      }
    }

    void loadRoadDistances()
    return () => controller.abort()
  }, [distanceOrigin, providers])

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
      return {
        charger,
        point,
        distance: provider && roadDistanceStatus === 'ready' ? roadDistances[provider.id] ?? null : null,
      }
    }).sort((first, second) => distanceOrigin
      ? (first.distance ?? Number.POSITIVE_INFINITY) - (second.distance ?? Number.POSITIVE_INFINITY)
      : 0)
  }, [chargers, providers, search, distanceOrigin, roadDistances, roadDistanceStatus])

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
      distanceLabel: distance === null ? null : `${formatRoadDistance(distance)} drive`,
    })), [nearbyChargers])
  const nearestMappedChargerId = roadDistanceStatus === 'ready'
    ? nearbyChargers.find(({ distance }) => distance !== null)?.charger.id
    : undefined
  const selectedCharger = nearbyChargers.find(({ charger }) => charger.id === selectedChargerId)

  function selectMapLocation(point: Point) {
    setErrorMessage('')
    setSuccessMessage('Map location selected. Nearby charging points are sorted by driving distance.')
    setDistanceOrigin(point)
    setUserLocation(point)
    setSearchCenter(point)
    setPickingLocation(false)
  }

  function handleMapLocationSelect(point: Point) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)
      || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) {
      setErrorMessage('The selected map location is invalid. Please select another point.')
      return
    }
    selectMapLocation(point)
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
          setPickingLocation(false)
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className={`rounded-full px-6 py-3 font-semibold text-white ${pickingLocation ? 'bg-fuchsia-700' : 'bg-slate-900'}`}
              onClick={() => setPickingLocation((picking) => !picking)}
              type="button"
            >
              {pickingLocation ? 'Cancel map selection' : 'Choose location on map'}
            </button>
            <button className="rounded-full border border-emerald-700 px-6 py-3 font-semibold text-emerald-800 disabled:cursor-wait disabled:opacity-60" disabled={locating} onClick={useMyLocation} type="button">
              {locating ? 'Finding you...' : 'Use my location'}
            </button>
          </div>
          <input
            aria-label="Filter charging points"
            className={fieldClass}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter charging points by station, connector, or host"
            value={search}
          />
        </div>

        {pickingLocation && (
          <p className="mt-4 rounded-xl bg-fuchsia-50 p-3 text-sm font-medium text-fuchsia-900" role="status">
            Click anywhere on the map to set your location and find the nearest charging points.
          </p>
        )}
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
            pickingLocation={pickingLocation}
            onMapLocationSelect={handleMapLocationSelect}
            key={`${searchCenter.lat},${searchCenter.lng}`}
          />
        </section>

        {selectedChargerDetails && (
          <section className="mt-8">
            <article className="rounded-3xl border border-emerald-500 bg-white p-6 ring-2 ring-emerald-100">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {selectedChargerDetails.charger.id === nearestMappedChargerId && <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Nearest charging point</p>}
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{selectedChargerDetails.charger.charger_type} charger · {selectedChargerDetails.charger.rated_power_kw} kW</p>
                  <h3 className="mt-2 text-xl font-semibold">{selectedChargerDetails.charger.name}</h3>
                  <p className="mt-1 text-slate-600">{selectedChargerDetails.provider?.business_name ?? 'Charging provider'}{selectedChargerDetails.provider?.address ? ` · ${selectedChargerDetails.provider.address}` : ''}</p>
                  <p className="mt-2 text-sm font-medium text-emerald-800">
                    {selectedChargerDetails.distance === null
                      ? roadDistanceStatus === 'loading'
                        ? 'Calculating driving distance...'
                        : roadDistanceStatus === 'error'
                          ? 'Driving distance unavailable'
                          : roadDistanceStatus === 'ready' && distanceOrigin
                            ? 'No driving route found'
                          : 'Choose your location to calculate distance'
                      : `${formatRoadDistance(selectedChargerDetails.distance)} by road`}
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
          </section>
        )}
      </div>
    </main>
  )
}
