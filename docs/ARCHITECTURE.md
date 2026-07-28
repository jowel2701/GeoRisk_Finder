# GeoRisk Finder — RFC de Arquitectura

## Stack

| Componente | Elección |
|---|---|
| Map engine | deck.gl v9 + @deck.gl/globe |
| Build | Vite + TypeScript |
| State | Zustand |
| UI | Vanilla TypeScript (web components lit-html opcional) |
| Base map | TileLayer + OSM carto tiles |
| 3D terrain | deck.gl TerrainLayer |
| Clustering | Supercluster + ScreenGridLayer |
| Timeline | Custom + deck.gl filter |

## Estructura de capas

```
0. OceanBackground (SimpleMeshLayer + SphereGeometry)
1. Terrain (TerrainLayer)
2. BaseMap (TileLayer OSM)
3. Graticule (PathLayer, opcional)
4. RiskHexagons (H3HexagonLayer)
5. EarthquakeClusters (CPUGridLayer / ScatterplotLayer)
6. CyclonePaths (PathLayer)
7. VolcanoMarkers (ScatterplotLayer)
8. HeatmapOverlay (ScreenGridLayer)
9. HotspotLabels (TextLayer)
10. SelectionHighlight (PolygonLayer)
```

## Carga progresiva

```
App init
  → cargar config
  → mostrar globo + heatmap global
  → background fetch: /api/layers/summary
  → background fetch: /api/layers/h3?resolution=3
  → al zoom: /api/layers/h3?resolution=5&bbox=
  → al click: /api/layers/detail?h3_index=
```

## API backend (FastAPI)

```
GET /api/layers
GET /api/layers/h3?resolution=&bbox=
GET /api/layers/earthquakes?bbox=&min_mag=&from=&to=
GET /api/layers/cyclones?bbox=
GET /api/layers/volcanoes?bbox=
GET /api/layers/detail?h3_index=
GET /api/search?q=
GET /api/ranking?by=risk&limit=10
GET /api/timeline?h3_index=&from=&to=
```

## Plan de migración

### Fase 1 — Fundación
- Vite + TS + deck.gl v9
- GlobeView + TileLayer (base map)
- Port de capas existentes

### Fase 2 — Mapa base profesional
- TileLayer OSM
- TerrainLayer
- Leyenda

### Fase 3 — UX de analista
- Risk breakdown panel
- Filtros reactivos
- Timeline
- Clustering
- Geocoder

### Fase 4 — Inteligencia
- City ranking
- Spatial query
- Análisis de sitio
- Delta de riesgo
- Export

### Fase 5 — Escalabilidad
- Cache IndexedDB
- Service Worker
- Backend optimizado
