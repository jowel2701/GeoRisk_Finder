import {
  ScatterplotLayer,
  PathLayer,
  PolygonLayer,
  LineLayer,
  TextLayer,
  BitmapLayer,
} from '@deck.gl/layers';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { ScreenGridLayer, HeatmapLayer } from '@deck.gl/aggregation-layers';
import type { LayerDescriptor } from './api';

function accessor(value: any): any {
  if (typeof value === 'function') return value;
  if (typeof value === 'string') return (d: any) => d[value];
  if (typeof value === 'number') return () => value;
  if (Array.isArray(value)) return () => value;
  return value;
}

const LAYER_MAP: Record<string, any> = {
  ScatterplotLayer,
  PathLayer,
  PolygonLayer,
  LineLayer,
  H3HexagonLayer,
  HeatmapLayer,
  ScreenGridLayer,
};

const EXTRUSION_LAYERS = new Set(['h3']);

export async function loadContinentPolygons(): Promise<any[]> {
  const r = await fetch('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_land.geojson');
  const gj = await r.json();
  const polys: any[] = [];
  for (const f of gj.features) {
    const t = f.geometry.type;
    const cs = f.geometry.coordinates;
    if (t === 'Polygon') {
      polys.push({ polygon: cs[0].map((c: number[]) => [c[0], c[1]]) });
    } else if (t === 'MultiPolygon') {
      for (const p of cs) {
        polys.push({ polygon: p[0].map((c: number[]) => [c[0], c[1]]) });
      }
    }
  }
  return polys;
}

export function createBaseMapLayer(landPolys: any[]): PolygonLayer {
  return new PolygonLayer({
    id: 'land',
    data: landPolys,
    getPolygon: (d: any) => d.polygon,
    getFillColor: [30, 55, 85],
    getLineColor: [50, 85, 130],
    getLineWidth: 0.5,
    opacity: 1,
    stroked: true,
    lineWidthMinPixels: 0.5,
  });
}

export function createDataLayers(descriptors: LayerDescriptor[]): any[] {
  const out: any[] = [];
  for (const d of descriptors) {
    const C = LAYER_MAP[d.type];
    if (!C) {
      console.warn(`Unknown layer type: ${d.type} (${d.id})`);
      continue;
    }
    const props: Record<string, any> = { ...d.props };
    for (const k of Object.keys(props)) {
      if (k.startsWith('get')) {
        props[k] = accessor(props[k]);
      }
    }
    if (d.id === 'h3') {
      props.extruded = false;
    }
    try {
      out.push(new C({ ...props, id: d.id, data: d.data, pickable: d.pickable }));
    } catch (e) {
      console.error(`Layer failed: ${d.id}`, e);
    }
  }
  return out;
}

export function createHeatmapLayer(data: any[]): ScreenGridLayer {
  return new ScreenGridLayer({
    id: 'risk-heatmap',
    data,
    getPosition: (d: any) => d.position || [d.lon, d.lat],
    getWeight: (d: any) => d.risk_score || 0.5,
    cellSizePixels: 20,
    colorRange: [
      [255, 255, 200, 50],
      [255, 200, 100, 80],
      [255, 150, 50, 120],
      [255, 80, 20, 160],
      [200, 30, 10, 200],
      [150, 0, 0, 220],
    ],
    aggregation: 'MEAN',
    opacity: 0.6,
  });
}

export function createHotspotLabels(hotspots: any[]): TextLayer | null {
  if (!hotspots.length) return null;
  return new TextLayer({
    id: 'hotspots',
    data: hotspots,
    getPosition: (d: any) => [d.lon, d.lat],
    getText: (d: any) => `${d.region || d.name || 'Zona'}\nRiesgo: ${(d.risk_score || 0).toFixed(2)}`,
    getSize: 13,
    getColor: [255, 255, 200, 240],
    getTextAnchor: 'start',
    getAlignmentBaseline: 'bottom',
    background: true,
    getBackgroundColor: [0, 0, 0, 160],
    padding: [4, 6],
  });
}

export function createClusterCentroidLabels(
  clusters: Record<number, any>,
  palette: string[],
): TextLayer | null {
  const data = Object.entries(clusters).map(([id, c]) => ({
    ...c,
    clusterId: Number(id),
    color: palette[Number(id) % palette.length],
  }));
  if (!data.length) return null;
  return new TextLayer({
    id: 'cluster-centroids',
    data,
    getPosition: (d: any) => [d.lon, d.lat],
    getText: (d: any) => `Grupo ${d.clusterId}`,
    getSize: 12,
    getColor: (d: any) => {
      const [r, g, b] = d.color;
      return [r, g, b, 220];
    },
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'bottom',
    background: true,
    backgroundColor: [0, 0, 0, 120],
    padding: [2, 4],
  });
}
