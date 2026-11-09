export type Point = { lat: number; lng: number }

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
