import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_STYLE } from '../mapStyle'

type ChargerPin = {
  id: string
  lat: number
  lng: number
  name: string
  pricePerKwh: number
  distanceKm: number | null
}

export function ChargerMap({ chargers, center, userLocation, nearestChargerId, selectedChargerId, onChargerSelect }: {
  chargers: ChargerPin[]
  center: { lat: number; lng: number }
  userLocation?: { lat: number; lng: number } | null
  nearestChargerId?: string
  selectedChargerId?: string
  onChargerSelect?: (chargerId: string) => void
}) {
  const mapRef = useRef<MapRef>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const initialViewState = useMemo(() => ({
    latitude: center.lat,
    longitude: center.lng,
    zoom: 12,
  }), [center])

  useEffect(() => {
    if (!mapLoaded || (!chargers.length && !userLocation)) return
    const points = chargers.map((charger) => [charger.lng, charger.lat] as [number, number])
    if (userLocation) points.push([userLocation.lng, userLocation.lat])
    const bounds: [[number, number], [number, number]] = [
      [
        Math.min(...points.map(([lng]) => lng)),
        Math.min(...points.map(([, lat]) => lat)),
      ],
      [
        Math.max(...points.map(([lng]) => lng)),
        Math.max(...points.map(([, lat]) => lat)),
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
    mapRef.current?.fitBounds(bounds, { padding: 56, maxZoom: 13 })
  }, [chargers, mapLoaded, userLocation])

  return (
    <Map
      ref={mapRef}
      initialViewState={initialViewState}
      onLoad={() => setMapLoaded(true)}
      style={{ width: '100%', height: '500px', borderRadius: '0.75rem' }}
      mapStyle={MAP_STYLE}
    >
      <NavigationControl position="top-right" />
      {chargers.map((charger) => (
        <Marker
          key={charger.id}
          latitude={charger.lat}
          longitude={charger.lng}
          anchor="bottom"
        >
          <button
            aria-label={`Select ${charger.name}, ₹${charger.pricePerKwh} per kWh`}
            aria-pressed={charger.id === selectedChargerId}
            className="flex cursor-pointer flex-col items-center border-0 bg-transparent p-1"
            onClick={() => onChargerSelect?.(charger.id)}
            type="button"
          >
            {charger.id === nearestChargerId && (
              <span className="mb-1 rounded-full bg-blue-700 px-2 py-1 text-xs font-semibold text-white shadow">
                Nearest
              </span>
            )}
            {charger.distanceKm !== null && (
              <span className="mb-1 rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-white shadow">
                {charger.distanceKm.toFixed(1)} km
              </span>
            )}
            <span className={`rounded-full px-2 py-1 text-xs font-semibold text-white shadow ${charger.id === selectedChargerId ? 'bg-amber-500' : charger.id === nearestChargerId ? 'bg-blue-700' : 'bg-emerald-600'}`}>
              ₹{charger.pricePerKwh}/kWh
            </span>
            <span className={`mt-1 h-3 w-1 ${charger.id === selectedChargerId ? 'bg-amber-500' : charger.id === nearestChargerId ? 'bg-blue-700' : 'bg-emerald-600'}`} />
          </button>
        </Marker>
      ))}
      {userLocation && (
        <Marker latitude={userLocation.lat} longitude={userLocation.lng} anchor="bottom">
          <div aria-label="Your location" className="flex flex-col items-center" role="img">
            <span className="mb-1 rounded-full bg-fuchsia-700 px-2 py-1 text-xs font-bold text-white shadow-md">
              Your location
            </span>
            <span className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-fuchsia-600 shadow-lg ring-4 ring-fuchsia-300/70">
              <span className="h-2 w-2 rounded-full bg-white" />
            </span>
          </div>
        </Marker>
      )}
    </Map>
  )
}
