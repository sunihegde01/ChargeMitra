import { useEffect, useRef, useState } from 'react'
import Map, { Layer, Marker, NavigationControl, Source } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_STYLE } from '../mapStyle'

type Point = { lat: number; lng: number }
type Route = {
  coordinates: [number, number][]
  distanceMeters: number
  durationSeconds: number
}
type RouteResponse = {
  code?: string
  routes?: Array<{
    distance: number
    duration: number
    geometry: { coordinates: [number, number][] }
  }>
}

function distanceMeters(from: Point, to: Point): number {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDifference = radians(to.lat - from.lat)
  const longitudeDifference = radians(to.lng - from.lng)
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(longitudeDifference / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export function ChargerDirections({ destination, chargerName }: {
  destination: Point
  chargerName: string
}) {
  const mapRef = useRef<MapRef>(null)
  const lastRouteOrigin = useRef<Point | null>(null)
  const [tracking, setTracking] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<Point | null>(null)
  const [routeOrigin, setRouteOrigin] = useState<Point | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!tracking) return
    if (!navigator.geolocation) {
      setErrorMessage('Location tracking is not supported by this browser.')
      setTracking(false)
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const point = { lat: coords.latitude, lng: coords.longitude }
        if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)
          || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) {
          setErrorMessage('Your device returned an invalid location.')
          return
        }

        setCurrentLocation(point)
        if (!lastRouteOrigin.current || distanceMeters(lastRouteOrigin.current, point) >= 100) {
          lastRouteOrigin.current = point
          setRouteOrigin(point)
        }
        setErrorMessage('')
      },
      (error) => {
        setErrorMessage(error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. Allow location access in your browser settings to use live directions.'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'Your current location is unavailable. Check your device location services and try again.'
            : 'Getting your location timed out. Please try again.')
        if (error.code === error.PERMISSION_DENIED) setTracking(false)
      },
      { enableHighAccuracy: false, maximumAge: 10000, timeout: 30000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [tracking])

  useEffect(() => {
    if (!routeOrigin) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setRouteLoading(true)
      try {
        const coordinates = `${routeOrigin.lng},${routeOrigin.lat};${destination.lng},${destination.lat}`
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
          { signal: controller.signal },
        )
        if (!response.ok) throw new Error(`Route lookup failed (${response.status}).`)
        const result = await response.json() as RouteResponse
        const nextRoute = result.routes?.[0]
        if (result.code !== 'Ok' || !nextRoute || !nextRoute.geometry.coordinates.length) {
          throw new Error('No driving route was found to this charging station.')
        }
        setRoute({
          coordinates: nextRoute.geometry.coordinates,
          distanceMeters: nextRoute.distance,
          durationSeconds: nextRoute.duration,
        })
        setErrorMessage('')
      } catch (error) {
        if (controller.signal.aborted) return
        setErrorMessage(error instanceof Error ? error.message : 'Could not calculate a route to the charging station.')
      } finally {
        if (!controller.signal.aborted) setRouteLoading(false)
      }
    }, 500)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [destination.lat, destination.lng, routeOrigin])

  useEffect(() => {
    const points = [destination, ...(currentLocation ? [currentLocation] : [])]
    const bounds: [[number, number], [number, number]] = [
      [
        Math.min(...points.map((point) => point.lng)),
        Math.min(...points.map((point) => point.lat)),
      ],
      [
        Math.max(...points.map((point) => point.lng)),
        Math.max(...points.map((point) => point.lat)),
      ],
    ]
    if (bounds[0][0] === bounds[1][0]) {
      bounds[0][0] -= 0.005
      bounds[1][0] += 0.005
    }
    if (bounds[0][1] === bounds[1][1]) {
      bounds[0][1] -= 0.005
      bounds[1][1] += 0.005
    }
    mapRef.current?.fitBounds(bounds, { padding: 48, maxZoom: 14 })
  }, [currentLocation, destination])

  function startTracking() {
    setErrorMessage('')
    if (!navigator.geolocation) {
      setErrorMessage('Location tracking is not supported by this browser.')
      return
    }
    if (!window.isSecureContext) {
      setErrorMessage('Live location requires a secure connection. Open this site on localhost or HTTPS.')
      return
    }
    setTracking(true)
  }

  const routeGeometry = route ? {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: route.coordinates,
    },
  } : null
  const directionsUrl = new URL('https://www.google.com/maps/dir/')
  directionsUrl.searchParams.set('api', '1')
  directionsUrl.searchParams.set('destination', `${destination.lat},${destination.lng}`)
  directionsUrl.searchParams.set('travelmode', 'driving')
  if (currentLocation) {
    directionsUrl.searchParams.set('origin', `${currentLocation.lat},${currentLocation.lng}`)
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Route to {chargerName}</h2>
          <p className="mt-1 text-sm text-slate-600">Start live directions to see your location, route, and estimated travel time.</p>
        </div>
        <button
          className={`rounded-full px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 ${tracking ? 'bg-slate-700' : 'bg-emerald-700'}`}
          onClick={() => tracking ? setTracking(false) : startTracking()}
          type="button"
        >
          {tracking ? 'Stop live tracking' : 'Start live directions'}
        </button>
      </div>

      {errorMessage && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">{errorMessage}</p>}
      {route && (
        <div className="mt-4 flex flex-wrap gap-4 rounded-xl bg-emerald-50 p-4 text-emerald-900" role="status">
          <p><span className="font-semibold">Estimated drive time:</span> {Math.max(1, Math.ceil(route.durationSeconds / 60))} min</p>
          <p><span className="font-semibold">Route distance:</span> {(route.distanceMeters / 1000).toFixed(1)} km</p>
          {routeLoading && <p className="text-sm">Updating route...</p>}
        </div>
      )}
      {!route && tracking && routeLoading && <p className="mt-4 text-sm text-slate-600">Finding your location and route...</p>}
      <p className="mt-3 text-xs text-slate-500">Travel time is an estimate and does not include live traffic. Your location is sent to the routing service to calculate directions, but is not shared with the host. Tracking stops when you stop it or leave this page.</p>
      <div className="mt-4 h-[360px] overflow-hidden rounded-xl border border-slate-200">
        <Map
          ref={mapRef}
          initialViewState={{ latitude: destination.lat, longitude: destination.lng, zoom: 13 }}
          mapStyle={MAP_STYLE}
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position="top-right" />
          {routeGeometry && (
            <Source data={routeGeometry} id="charger-route" type="geojson">
              <Layer
                id="charger-route-line"
                paint={{ 'line-color': '#047857', 'line-width': 5, 'line-opacity': 0.85 }}
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              />
            </Source>
          )}
          {currentLocation && (
            <Marker anchor="center" latitude={currentLocation.lat} longitude={currentLocation.lng}>
              <div className="h-5 w-5 rounded-full border-2 border-white bg-blue-600 shadow-md" title="Your live location" />
            </Marker>
          )}
          <Marker anchor="bottom" latitude={destination.lat} longitude={destination.lng}>
            <div className="rounded-full bg-emerald-700 px-3 py-2 text-sm font-semibold text-white shadow-lg">{chargerName}</div>
          </Marker>
        </Map>
      </div>
      <a className="mt-3 inline-flex text-sm font-semibold text-emerald-700 underline" href={directionsUrl.toString()} rel="noreferrer" target="_blank">
        Open turn-by-turn directions
      </a>
    </section>
  )
}
