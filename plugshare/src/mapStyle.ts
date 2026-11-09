import type { StyleSpecification } from 'maplibre-gl'

export const MAP_STYLE = {
  version: 8,
  sources: {
    openstreetmap: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'openstreetmap-base',
      type: 'raster',
      source: 'openstreetmap',
    },
  ],
} satisfies StyleSpecification
