import { useMemo } from 'react'
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_STYLE } from '../mapStyle'

type ChargerPin = {
  id: string
  lat: number
  lng: number
  name: string
  pricePerKwh: number
}

export function ChargerMap({ chargers, center, userLocation, nearestChargerId }: {
  chargers: ChargerPin[]
  center: { lat: number; lng: number }
  userLocation?: { lat: number; lng: number } | null
  nearestChargerId?: string
}) {
  const initialViewState = useMemo(() => ({
    latitude: center.lat,
    longitude: center.lng,
    zoom: 12,
  }), [center])

  return (
    <Map
      initialViewState={initialViewState}
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
          <div className="flex flex-col items-center">
            {charger.id === nearestChargerId && (
              <div className="mb-1 rounded-full bg-blue-700 px-2 py-1 text-xs font-semibold text-white shadow">
                Nearest
              </div>
            )}
            <div className={`rounded-full px-2 py-1 text-xs font-semibold text-white shadow ${charger.id === nearestChargerId ? 'bg-blue-700' : 'bg-emerald-600'}`}>
              ₹{charger.pricePerKwh}/kWh
            </div>
            <div className={`mt-1 h-3 w-1 ${charger.id === nearestChargerId ? 'bg-blue-700' : 'bg-emerald-600'}`} />
          </div>
        </Marker>
      ))}
      {userLocation && (
        <Marker latitude={userLocation.lat} longitude={userLocation.lng} anchor="center">
          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-600 shadow-md" title="Your location">
            <span className="sr-only">Your location</span>
          </div>
        </Marker>
      )}
    </Map>
  )
}
