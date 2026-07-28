const BASE = '/api';

export interface LayerDescriptor {
  id: string;
  type: string;
  data: any[];
  props: Record<string, any>;
  pickable: boolean;
}

export interface LayersResponse {
  layers: LayerDescriptor[];
  view_state: {
    latitude: number;
    longitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
  };
}

export async function fetchLayers(): Promise<LayersResponse> {
  const r = await fetch(`${BASE}/layers`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function searchLocation(q: string): Promise<any> {
  const r = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetchRanking(limit: number = 10): Promise<any[]> {
  try {
    const r = await fetch(`${BASE}/ranking?limit=${limit}`);
    if (!r.ok) return [];
    return r.json();
  } catch {
    return [];
  }
}

export async function fetchTimeline(h3Index: string, from: number, to: number): Promise<any[]> {
  try {
    const r = await fetch(`${BASE}/timeline?h3_index=${h3Index}&from=${from}&to=${to}`);
    if (!r.ok) return [];
    return r.json();
  } catch {
    return [];
  }
}
