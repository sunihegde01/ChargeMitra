import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_STYLE } from '../../mapStyle'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase'

type Point = { latitude: number; longitude: number }
type Provider = { id: string; business_name: string; category: string; address: string | null }

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15'
const categories = ['HOME', 'APARTMENT', 'OFFICE', 'COMMERCIAL', 'OTHER']
const defaultMapView = { latitude: 20.5937, longitude: 78.9629, zoom: 4 }

function parsePoint(location: unknown): Point | null {
  if (typeof location === 'string') {
    const point = location.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i)
    if (point) return { longitude: Number(point[1]), latitude: Number(point[2]) }
    try {
      return parsePoint(JSON.parse(location) as unknown)
    } catch {
      return null
    }
  }
  if (typeof location === 'object' && location !== null && 'coordinates' in location) {
    const coordinates = location.coordinates
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      const [longitude, latitude] = coordinates
      if (typeof latitude === 'number' && typeof longitude === 'number') return { latitude, longitude }
    }
  }
  return null
}

export default function AddChargerPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [provider, setProvider] = useState<Provider | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [category, setCategory] = useState('COMMERCIAL')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [mapViewState, setMapViewState] = useState(defaultMapView)
  const [name, setName] = useState('')
  const [chargerType, setChargerType] = useState('AC')
  const [power, setPower] = useState('')
  const [connector, setConnector] = useState('Type 2')
  const [price, setPrice] = useState('')
  const [hasMeter, setHasMeter] = useState(false)
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const locationSelected = Boolean(latitude && longitude)

  useEffect(() => {
    let active = true
    async function loadProvider() {
      if (!user) return
      const { data, error } = await supabase
        .from('providers')
        .select('id,business_name,category,address,location')
        .eq('profile_id', user.id)
        .maybeSingle()
      if (!active) return
      if (error) setErrorMessage(error.message)
      else if (data) {
        setProvider(data)
        setBusinessName(data.business_name)
        setCategory(data.category)
        setAddress(data.address ?? '')
        const point = parsePoint(data.location)
        if (point) {
          setLatitude(String(point.latitude))
          setLongitude(String(point.longitude))
          setMapViewState({ ...point, zoom: 15 })
        }
      }
      setInitializing(false)
    }
    void loadProvider()
    return () => { active = false }
  }, [user])

  async function setSelectedLocation(latitude: number, longitude: number) {
    setLatitude(String(latitude))
    setLongitude(String(longitude))
    setErrorMessage('')
    setSuccessMessage('Location selected. Looking up the address...')

    setMapViewState((view) => ({
      ...view,
      latitude,
      longitude,
      zoom: Math.max(view.zoom, 15),
    }))

    try {
      const query = new URLSearchParams({ lat: String(latitude), lon: String(longitude) })
      const response = await fetch(`https://photon.komoot.io/reverse?${query}`)
      if (!response.ok) throw new Error(`Address lookup failed (${response.status}).`)
      const result = await response.json() as {
        features?: Array<{ properties?: Record<string, unknown> }>
      }
      const properties = result.features?.[0]?.properties
      const addressParts = properties
        ? [
            properties.name,
            [properties.housenumber, properties.street].filter((part) => typeof part === 'string').join(' '),
            properties.postcode,
            properties.city,
            properties.state,
            properties.country,
          ].filter((part): part is string => typeof part === 'string' && part.length > 0)
        : []
      const uniqueParts = [...new Set(addressParts)]
      setAddress(uniqueParts.join(', '))
      setSuccessMessage(uniqueParts.length
        ? 'Location selected and address filled in.'
        : 'Location selected. No address was found; the map pin will be saved.')
    } catch {
      setAddress('')
      setSuccessMessage('Location selected. Address lookup was unavailable; the map pin will be saved.')
    }
  }

  function useCurrentLocation() {
    setErrorMessage('')
    setSuccessMessage('')

    if (!navigator.geolocation) {
      setErrorMessage('Location access is not supported by this browser. Select the location on the map instead.')
      return
    }
    if (!window.isSecureContext) {
      setErrorMessage('Location access requires a secure connection. Open this site on localhost or HTTPS, or select a location on the map.')
      return
    }

    setLocating(true)
    try {
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        setLocating(false)
        void setSelectedLocation(coords.latitude, coords.longitude)
      }, (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. Allow it for this site in your browser settings, or select a location on the map.'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'Your location is unavailable right now. Check device location services or select a location on the map.'
            : 'Finding your location timed out. Try again or select a location on the map.'
        setErrorMessage(message)
        setLocating(false)
      }, { enableHighAccuracy: false, timeout: 30000, maximumAge: 120000 })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not start location access. Check this site's browser permissions.")
      setLocating(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      let providerId = provider?.id
      const lat = Number(latitude)
      const lng = Number(longitude)
      if (!latitude || !longitude || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        setErrorMessage('Select the charging point location by clicking the map or using your current location.')
        return
      }

      if (!providerId) {
        if (!businessName.trim()) {
          setErrorMessage('Enter a business name before saving.')
          return
        }
        const { data, error } = await supabase.from('providers').insert({
          profile_id: user.id,
          business_name: businessName.trim(),
          category,
          address: address.trim() || null,
          location: `SRID=4326;POINT(${lng} ${lat})`,
        }).select('id').single()
        if (error || !data?.id) {
          setErrorMessage(error?.message ?? 'Provider profile was created without returning an ID.')
          return
        }
        const newProviderId = data.id
        providerId = newProviderId
        setProvider({ id: newProviderId, business_name: businessName.trim(), category, address: address.trim() || null })

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        if (profileError) {
          setErrorMessage(`Provider created, but account role could not be checked: ${profileError.message}`)
          return
        }
        if (profile?.role === 'EV_OWNER') {
          const { error: roleError } = await supabase.from('profiles').update({ role: 'BOTH' }).eq('id', user.id)
          if (roleError) {
            setErrorMessage(`Provider created, but account role could not be updated: ${roleError.message}`)
            return
          }
        }
      }

      if (!providerId) {
        setErrorMessage('Provider profile was not available. Please try again.')
        return
      }

      const { error: locationError } = await supabase
        .from('providers')
        .update({
          address: address.trim() || null,
          location: `SRID=4326;POINT(${lng} ${lat})`,
        })
        .eq('id', providerId)
      if (locationError) {
        setErrorMessage(`Could not save the charging point location: ${locationError.message}`)
        return
      }

      const { error } = await supabase.from('chargers').insert({
        provider_id: providerId,
        name: name.trim(),
        charger_type: chargerType,
        rated_power_kw: Number(power),
        connector_type: connector.trim(),
        price_per_kwh: Number(price),
        has_dedicated_meter: hasMeter,
      })
      if (error) {
        setErrorMessage(`Provider profile is saved, but the charger could not be added: ${error.message}`)
        return
      }
      setSuccessMessage('Charger added successfully.')
      navigate('/provider/dashboard')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not add the charger.')
    } finally {
      setLoading(false)
    }
  }

  if (initializing) return <main className="p-8">Loading provider profile...</main>

  return (
    <main className="min-h-screen bg-[#f7f9f6] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <Link className="text-sm font-semibold text-emerald-700" to="/provider/dashboard">← Provider dashboard</Link>
        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h1 className="text-3xl font-semibold">{provider ? 'Add a charger' : 'Set up your provider and charger'}</h1>
          <p className="mt-2 text-slate-600">Add station details and the rate drivers will see.</p>

          {errorMessage && <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-800" role="alert">{errorMessage}</p>}
          {successMessage && <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-emerald-800" role="status">{successMessage}</p>}

          <form className="mt-7 grid gap-5 sm:grid-cols-2" onSubmit={(event) => void handleSubmit(event)}>
            {!provider && <>
              <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
                Business name
                <input className={fieldClass} onChange={(event) => setBusinessName(event.target.value)} required value={businessName} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Location category
                <select className={fieldClass} onChange={(event) => setCategory(event.target.value)} value={category}>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </>}
            <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
              Charging point address (optional)
              <input className={fieldClass} onChange={(event) => setAddress(event.target.value)} placeholder="Filled automatically when a map location is selected" value={address} />
            </label>
            <div className="sm:col-span-2">
              <h2 className="font-semibold">Charging point location</h2>
              <p className="mt-1 text-sm text-slate-600">Use your current location or click the map to place the charging point pin.</p>
              <button
                className="mt-3 rounded-full border border-emerald-700 px-5 py-3 font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={locating}
                onClick={useCurrentLocation}
                type="button"
              >
                {locating ? 'Getting location and address...' : locationSelected ? 'Location selected · Update location' : 'Use my current location'}
              </button>
              {locationSelected && (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
                  <p className="font-semibold">Charging point location selected</p>
                  <p className="mt-1">{address || 'Address lookup unavailable; the map pin will be saved.'}</p>
                  <p className="mt-1 text-xs text-emerald-800">Coordinates: {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}</p>
                </div>
              )}
              <div className="mt-4 h-[360px] overflow-hidden rounded-2xl border border-slate-200">
                <Map
                  {...mapViewState}
                  mapStyle={MAP_STYLE}
                  onClick={(event) => void setSelectedLocation(event.lngLat.lat, event.lngLat.lng)}
                  onMove={(event) => setMapViewState({
                    latitude: event.viewState.latitude,
                    longitude: event.viewState.longitude,
                    zoom: event.viewState.zoom,
                  })}
                  style={{ width: '100%', height: '100%' }}
                >
                  <NavigationControl position="top-right" />
                  {latitude && longitude && (
                    <Marker anchor="bottom" latitude={Number(latitude)} longitude={Number(longitude)}>
                      <svg aria-label="Selected charger location" className="h-10 w-8 drop-shadow-md" role="img" viewBox="0 0 32 44">
                        <path d="M16 1C7.72 1 1 7.72 1 16c0 10.4 15 27 15 27s15-16.6 15-27C31 7.72 24.28 1 16 1Z" fill="#facc15" stroke="#854d0e" strokeWidth="2" />
                        <circle cx="16" cy="16" r="5" fill="#854d0e" />
                      </svg>
                    </Marker>
                  )}
                </Map>
              </div>
              <p className="mt-2 text-sm text-slate-600">Drag the map to explore and zoom in for a precise location. This is the host location shown to users for its charging points.</p>
            </div>
            <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
              Charger name
              <input className={fieldClass} onChange={(event) => setName(event.target.value)} required value={name} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Charger type
              <select className={fieldClass} onChange={(event) => setChargerType(event.target.value)} value={chargerType}>
                <option value="AC">AC</option>
                <option value="DC">DC</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Rated power (kW)
              <input className={fieldClass} min="0.1" onChange={(event) => setPower(event.target.value)} required step="0.1" type="number" value={power} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Connector type
              <input className={fieldClass} onChange={(event) => setConnector(event.target.value)} required value={connector} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Price per kWh (₹)
              <input className={fieldClass} min="0.01" onChange={(event) => setPrice(event.target.value)} required step="0.01" type="number" value={price} />
            </label>
            <label className="flex items-center gap-3 text-sm font-medium sm:col-span-2">
              <input checked={hasMeter} onChange={(event) => setHasMeter(event.target.checked)} type="checkbox" />
              This charger has a dedicated energy meter
            </label>
            <button className="rounded-full bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60 sm:col-span-2" disabled={loading} type="submit">
              {loading ? 'Saving...' : 'Save charger'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
