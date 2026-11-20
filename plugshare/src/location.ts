export type Point = { lat: number; lng: number }
export type ReverseGeocodedAddress = {
  streetAddress: string
  city: string
  state: string
  pinCode: string
  formattedAddress: string
}

export function approximatePoint(point: Point): Point {
  const distanceMeters = 750 + Math.random() * 500
  const bearing = Math.random() * Math.PI * 2
  const latitudeRadians = point.lat * Math.PI / 180
  const lat = point.lat + Math.cos(bearing) * distanceMeters / 111_320
  const lng = point.lng
    + Math.sin(bearing) * distanceMeters / (111_320 * Math.max(0.01, Math.abs(Math.cos(latitudeRadians))))
  return {
    lat: Math.max(-89.9, Math.min(89.9, lat)),
    lng: ((lng + 180) % 360 + 360) % 360 - 180,
  }
}

function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null || !('lat' in value) || !('lng' in value)) return false
  const { lat, lng } = value
  return typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

function parseGeoJson(value: unknown): Point | null {
  if (typeof value !== 'object' || value === null) return null
  if ('coordinates' in value && Array.isArray(value.coordinates)) {
    const [lng, lat] = value.coordinates
    const point = { lat, lng }
    if (isPoint(point)) return point
  }
  if ('geometry' in value) return parseGeoJson(value.geometry)
  return null
}

function parseEwkb(value: string): Point | null {
  const hex = value.replace(/^\\x/i, '')
  if (!/^(?:[0-9a-f]{2}){21,}$/i.test(hex) || hex.length % 2 !== 0) return null
  const bytes = Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16))
  const view = new DataView(bytes.buffer)
  const littleEndian = bytes[0] === 1
  if (!littleEndian && bytes[0] !== 0) return null

  const geometryType = view.getUint32(1, littleEndian)
  let offset = 5
  if ((geometryType & 0x20000000) !== 0) offset += 4
  if (bytes.length < offset + 16) return null

  const point = {
    lng: view.getFloat64(offset, littleEndian),
    lat: view.getFloat64(offset + 8, littleEndian),
  }
  return isPoint(point) ? point : null
}

export function parsePoint(location: unknown): Point | null {
  if (typeof location === 'string') {
    const point = location.match(/^\s*(?:SRID=\d+;)?POINT(?:\s+Z|\s+M|\s+ZM)?\s*\(\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i)
    if (point) {
      const parsed = { lng: Number(point[1]), lat: Number(point[2]) }
      if (isPoint(parsed)) return parsed
    }

    try {
      const parsed = JSON.parse(location) as unknown
      return parseGeoJson(parsed)
    } catch {
      return parseEwkb(location)
    }
  }
  return parseGeoJson(location)
}

export async function reverseGeocode(point: Point): Promise<ReverseGeocodedAddress> {
  const query = new URLSearchParams({ lat: String(point.lat), lon: String(point.lng) })
  const response = await fetch(`https://photon.komoot.io/reverse?${query}`)
  if (!response.ok) throw new Error(`Address lookup failed (${response.status}).`)
  const result = await response.json() as {
    features?: Array<{ properties?: Record<string, unknown> }>
  }
  const properties = result.features?.[0]?.properties
  const readString = (...keys: string[]) => {
    for (const key of keys) {
      const value = properties?.[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return ''
  }
  const buildingAndStreet = [
    readString('housenumber'),
    readString('street'),
  ].filter(Boolean).join(' ')
  const streetAddress = [...new Set([readString('name'), buildingAndStreet].filter(Boolean))].join(', ')
  const city = readString('city', 'town', 'village', 'municipality', 'county', 'district')
  const state = readString('state')
  const pinCode = readString('postcode')
  const formattedAddress = [...new Set([
    readString('name'),
    buildingAndStreet,
    pinCode,
    city,
    state,
    readString('country'),
  ].filter(Boolean))].join(', ')

  return { streetAddress, city, state, pinCode, formattedAddress }
}
