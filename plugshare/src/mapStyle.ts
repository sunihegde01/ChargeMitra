import type { StyleSpecification } from 'maplibre-gl'

export const MAP_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [
    {
      id: 'carto-base',
      type: 'raster',
      source: 'carto',
    },
  ],
} satisfies StyleSpecification
