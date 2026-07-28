import { Deck, _GlobeView as GlobeView, FlyToInterpolator } from '@deck.gl/core';
import { store } from './store';
import { fetchLayers, searchLocation, fetchRanking } from './api';
import { loadContinentPolygons, createBaseMapLayer, createDataLayers, createHeatmapLayer, createHotspotLabels } from './layers';

const s = store.getState;
const sub = store.subscribe;

const mapEl = document.getElementById('map') as HTMLDivElement;

const deck = new Deck({
  parent: mapEl,
  views: new GlobeView({ id: 'globe' }),
  initialViewState: s().viewState as any,
  controller: true,
  style: { background: '#061840' },
  onViewStateChange: ({ viewState }: any) => {
    const st = s();
    if (!st.transitioning) {
      store.setState({ viewState });
      deck.setProps({ viewState });
    }
  },
  onClick: (info: any) => {
    if (info?.object && info?.layer) {
      store.getState().setSelectedFeature(info.object, info.layer.id);
    } else {
      store.getState().setSelectedFeature(null, '');
    }
  },
  onError: (e: any) => console.error('deck:', e),
});

const loadingOverlay = document.getElementById('loading-overlay');

store.getState().setDeckInstance(deck);

let rawDataCache: Record<string, any[]> = {};
let landPolysCache: any[] = [];
let totalRealEvents: { eq: number; cyc: number; vol: number; total: number } = { eq: 0, cyc: 0, vol: 0, total: 0 };

function updateFilteredLayers() {
  const filters = store.getState().filters;
  const rawLayers = store.getState().rawLayers;
  const activeTypes = filters.activeTypes;

  const filteredDescriptors = rawLayers.map((desc: any) => {
    const rawData = rawDataCache[desc.id] || [];
    let filteredData = rawData;

    if (EVENT_LAYERS.has(desc.id) && !activeTypes.includes(desc.id)) {
      filteredData = [];
    }

    if (desc.id === 'h3') {
      filteredData = rawData.filter((d: any) => d.risk_score >= filters.minRisk);
      if (store.getState().clusterColoring) {
        filteredData = filteredData.map((d: any) => ({ ...d, color: d.cluster_color || d.color }));
      }
    } else if (desc.id === 'earthquakes') {
      filteredData = rawData.filter((d: any) =>
        (d.magnitude ?? 0) >= filters.minMagnitude &&
        (d.depth ?? Infinity) <= filters.maxDepth
      );
    }

    if (desc.id !== 'graticule' && desc.id !== 'plates') {
      const maxYear = store.getState().timelineYear;
      filteredData = filteredData.filter((d: any) =>
        !d.year || d.year <= maxYear
      );
    }

    return { ...desc, data: filteredData };
  });

  const base = createBaseMapLayer(landPolysCache);
  const dataLayers = createDataLayers(filteredDescriptors);
  const maxYear = store.getState().timelineYear;
  const heatData = (rawDataCache['h3'] || []).filter((d: any) =>
    d.risk_score >= filters.minRisk && (!d.year || d.year <= maxYear)
  );
  const heatmap = createHeatmapLayer(heatData);
  const ranking = store.getState().hotspotRanking;
  const hotspotLabels = createHotspotLabels(ranking.slice(0, 6));
  const allLayers = [base, ...dataLayers, heatmap];
  if (hotspotLabels) allLayers.push(hotspotLabels);
  deck.setProps({ layers: allLayers });
}

const EVENT_LAYERS = new Set(['earthquakes', 'cyclones', 'volcanoes']);

const CURATED_CITIES: Record<string, { lat: number; lon: number; zoom: number; label: string }> = {
  'tokio': { lat: 35.6762, lon: 139.6503, zoom: 5, label: 'Tokio, Japón' },
  'japon': { lat: 36.2048, lon: 138.2529, zoom: 4, label: 'Japón' },
  'yokohama': { lat: 35.4437, lon: 139.6380, zoom: 6, label: 'Yokohama, Japón' },
  'manila': { lat: 14.5995, lon: 120.9842, zoom: 6, label: 'Manila, Filipinas' },
  'filipinas': { lat: 12.8797, lon: 121.7740, zoom: 5, label: 'Filipinas' },
  'yakarta': { lat: -6.2088, lon: 106.8456, zoom: 6, label: 'Yakarta, Indonesia' },
  'indonesia': { lat: -0.7893, lon: 113.9213, zoom: 4, label: 'Indonesia' },
  'santiago': { lat: -33.4489, lon: -70.6693, zoom: 6, label: 'Santiago, Chile' },
  'chile': { lat: -35.6751, lon: -71.5430, zoom: 4, label: 'Chile' },
  'lima': { lat: -12.0464, lon: -77.0428, zoom: 6, label: 'Lima, Perú' },
  'peru': { lat: -9.1900, lon: -75.0152, zoom: 5, label: 'Perú' },
  'ciudad de mexico': { lat: 19.4326, lon: -99.1332, zoom: 6, label: 'Ciudad de México' },
  'mexico': { lat: 23.6345, lon: -102.5528, zoom: 4, label: 'México' },
  'los angeles': { lat: 34.0522, lon: -118.2437, zoom: 6, label: 'Los Ángeles, EE.UU.' },
  'san francisco': { lat: 37.7749, lon: -122.4194, zoom: 6, label: 'San Francisco, EE.UU.' },
  'california': { lat: 36.7783, lon: -119.4179, zoom: 5, label: 'California, EE.UU.' },
  'anchorage': { lat: 61.2181, lon: -149.9003, zoom: 6, label: 'Anchorage, Alaska' },
  'alaska': { lat: 64.2008, lon: -149.4937, zoom: 4, label: 'Alaska, EE.UU.' },
  'medellin': { lat: 6.2476, lon: -75.5658, zoom: 7, label: 'Medellín, Colombia' },
  'bogota': { lat: 4.7110, lon: -74.0721, zoom: 7, label: 'Bogotá, Colombia' },
  'colombia': { lat: 4.5709, lon: -74.2973, zoom: 5, label: 'Colombia' },
  'caracas': { lat: 10.4806, lon: -66.9036, zoom: 7, label: 'Caracas, Venezuela' },
  'venezuela': { lat: 6.4238, lon: -66.5897, zoom: 5, label: 'Venezuela' },
  'napoles': { lat: 40.8518, lon: 14.2681, zoom: 7, label: 'Nápoles, Italia' },
  'italia': { lat: 41.8719, lon: 12.5674, zoom: 5, label: 'Italia' },
  'islandia': { lat: 64.9631, lon: -19.0208, zoom: 6, label: 'Islandia' },
  'reykjavik': { lat: 64.1466, lon: -21.9426, zoom: 7, label: 'Reykjavik, Islandia' },
  'nueva zelanda': { lat: -40.9006, lon: 174.8860, zoom: 5, label: 'Nueva Zelanda' },
  'wellington': { lat: -41.2865, lon: 174.7762, zoom: 7, label: 'Wellington, Nueva Zelanda' },
  'madrid': { lat: 40.4168, lon: -3.7038, zoom: 6, label: 'Madrid, España' },
  'espana': { lat: 40.4637, lon: -3.7492, zoom: 5, label: 'España' },
  'barcelona': { lat: 41.3874, lon: 2.1686, zoom: 7, label: 'Barcelona, España' },
  'valencia': { lat: 39.4699, lon: -0.3763, zoom: 7, label: 'Valencia, España' },
  'canarias': { lat: 28.2916, lon: -16.6291, zoom: 6, label: 'Islas Canarias, España' },
  'la palma': { lat: 28.6835, lon: -17.7646, zoom: 8, label: 'La Palma, Canarias' },
  'guatemala': { lat: 14.6349, lon: -90.5069, zoom: 7, label: 'Guatemala' },
  'san salvador': { lat: 13.6929, lon: -89.2182, zoom: 7, label: 'San Salvador, El Salvador' },
  'san jose': { lat: 9.9281, lon: -84.0907, zoom: 7, label: 'San José, Costa Rica' },
  'costa rica': { lat: 9.7489, lon: -83.7534, zoom: 6, label: 'Costa Rica' },
  'panama': { lat: 8.5379, lon: -80.7821, zoom: 6, label: 'Panamá' },
  'puerto rico': { lat: 18.2208, lon: -66.5901, zoom: 7, label: 'Puerto Rico' },
  'miami': { lat: 25.7617, lon: -80.1918, zoom: 7, label: 'Miami, EE.UU.' },
  'nueva orleans': { lat: 29.9511, lon: -90.0715, zoom: 7, label: 'Nueva Orleans, EE.UU.' },
  'hong kong': { lat: 22.3193, lon: 114.1694, zoom: 7, label: 'Hong Kong' },
  'taipei': { lat: 25.0330, lon: 121.5654, zoom: 7, label: 'Taipéi, Taiwán' },
  'port-au-prince': { lat: 18.5944, lon: -72.3074, zoom: 7, label: 'Puerto Príncipe, Haití' },
};

function computeVisibleCount(): number {
  const layers = (deck.props.layers || []) as any[];
  let eq = 0, cyc = 0, vol = 0;
  for (const l of layers) {
    if (!l) continue;
    if (l.id === 'earthquakes') eq = l.props?.data?.length || 0;
    if (l.id === 'cyclones') cyc = l.props?.data?.length || 0;
    if (l.id === 'volcanoes') vol = l.props?.data?.length || 0;
  }
  return { eq, cyc, vol, total: eq + cyc + vol };
}

function computeFilteredCount(): number {
  let eq = 0, cyc = 0, vol = 0;
  for (const [id, data] of Object.entries(rawDataCache)) {
    if (id === 'earthquakes') eq = (data as any[]).length;
    if (id === 'cyclones') cyc = (data as any[]).length;
    if (id === 'volcanoes') vol = (data as any[]).length;
  }
  return { eq, cyc, vol, total: eq + cyc + vol };
}

const CLUSTER_NAMES: Record<string, { business: string; humanitarian: string }> = {
  high_eq: {
    business: 'Alta actividad sísmica — evaluar costos de refuerzo estructural',
    humanitarian: 'Población expuesta a terremotos recurrentes — priorizar alertas tempranas',
  },
  high_cyc: {
    business: 'Corredor de ciclones — relevante para seguros y logística costera',
    humanitarian: 'Comunidades costeras vulnerables a tormentas — planes de evacuación urgentes',
  },
  high_vol: {
    business: 'Zona volcánica activa — potencial geotérmico y turístico',
    humanitarian: 'Riesgo eruptivo latente — requerimiento de monitoreo y rutas de escape',
  },
  multi: {
    business: 'Punto crítico multi-riesgo — prioridad para inversión en resiliencia',
    humanitarian: 'Máxima exposición a desastres — intervención humanitaria prioritaria',
  },
  moderate: {
    business: 'Riesgo moderado — viable con mitigación estándar',
    humanitarian: 'Exposición media — mantener protocolos básicos de protección civil',
  },
  low: {
    business: 'Bajo riesgo geológico — estable para desarrollo urbano e industrial',
    humanitarian: 'Condiciones favorables — baja exposición a desastres naturales',
  },
};

function computeClusterLabelsFromH3(h3Data: any[]): Record<number, any> {
  const groups: Record<number, { eq: number[]; cyc: number[]; vol: number[]; risk: number[]; lats: number[]; lons: number[] }> = {};
  for (const d of h3Data) {
    const c = d.kmeans_cluster;
    if (c === undefined || c === null) continue;
    if (!groups[c]) groups[c] = { eq: [], cyc: [], vol: [], risk: [], lats: [], lons: [] };
    groups[c].eq.push(d.n_earthquakes ?? d.eq_count ?? 0);
    groups[c].cyc.push(d.n_cyclones ?? d.cyclone_count ?? 0);
    groups[c].vol.push(d.n_volcanoes ?? d.volcano_count ?? 0);
    groups[c].risk.push(d.risk_score ?? 0);
    groups[c].lats.push(d.lat);
    groups[c].lons.push(d.lon);
  }
  const result: Record<number, any> = {};
  for (const [ck, vals] of Object.entries(groups)) {
    const c = Number(ck);
    const n = vals.eq.length;
    const eqM = vals.eq.reduce((a, b) => a + b, 0) / n;
    const cycM = vals.cyc.reduce((a, b) => a + b, 0) / n;
    const volM = vals.vol.reduce((a, b) => a + b, 0) / n;
    const riskM = vals.risk.reduce((a, b) => a + b, 0) / n;
    const latM = vals.lats.reduce((a, b) => a + b, 0) / n;
    const lonM = vals.lons.reduce((a, b) => a + b, 0) / n;

    let key: string;
    if (riskM > 0.6) {
      if (eqM > 5 && cycM > 3) key = 'multi';
      else if (eqM > 5) key = 'high_eq';
      else if (cycM > 3) key = 'high_cyc';
      else if (volM > 1) key = 'high_vol';
      else key = 'multi';
    } else if (riskM > 0.25) {
      key = 'moderate';
    } else {
      key = 'low';
    }
    const names = CLUSTER_NAMES[key] || CLUSTER_NAMES.moderate;
    result[c] = {
      business: names.business,
      humanitarian: names.humanitarian,
      eq: eqM, cyc: cycM, vol: volM, risk: riskM,
      lat: latM, lon: lonM,
      count: n,
    };
  }
  return result;
}

async function loadData() {
  try {
    const [landPolys, res] = await Promise.all([
      loadContinentPolygons().catch(() => []),
      fetchLayers(),
    ]);
    landPolysCache = landPolys;
    for (const layer of res.layers) {
      rawDataCache[layer.id] = layer.data;
    }
    totalRealEvents = computeFilteredCount() as any;
    store.getState().setRawLayers(res.layers);
    const h3Raw = rawDataCache['h3'] || [];
    if (h3Raw.length) {
      const clusterLabels = computeClusterLabelsFromH3(h3Raw);
      store.getState().setClusterLabels(clusterLabels);
    }
    updateFilteredLayers();
    if (res.view_state) {
      const vs = { ...res.view_state } as any;
      store.getState().setViewState(vs);
      deck.setProps({ viewState: vs });
    }
    store.getState().setLoading(false);
  } catch (e) {
    console.error('Load failed:', e);
    store.getState().setLoading(false);
  }
}

async function loadRanking() {
  try {
    const ranking = await fetchRanking(20);
    store.getState().setHotspotRanking(ranking || []);
  } catch (e) {
    console.error('Ranking failed:', e);
    store.getState().setRankingLoading(false);
  }
}

loadData();
loadRanking();

const sidebarEl = document.getElementById('sidebar')!;
const topbarEl = document.getElementById('topbar')!;
const intelEl = document.getElementById('intel-panel')!;
const timelineEl = document.getElementById('timeline-bar')!;

function renderTopbar() {
  const st = s();
  const visible = computeVisibleCount();
  const total = totalRealEvents;
  topbarEl.innerHTML = `
    <div class="topbar-inner">
      <div class="logo">GeoRisk Finder</div>
      <div class="search-box">
        <input type="text" id="search-input" placeholder="Buscar ciudad, región..." value="${st.searchQuery}" />
        <button id="search-btn">&#x1F50D;</button>
      </div>
      <div class="topbar-stats">
        <span>${visible.total.toLocaleString()} / ${total.total.toLocaleString()} eventos</span>
        <span title="Terremotos">TER ${visible.eq.toLocaleString()}</span>
        <span title="Ciclones">CIC ${visible.cyc.toLocaleString()}</span>
        <span title="Volcanes">VOL ${visible.vol.toLocaleString()}</span>
      </div>
    </div>
  `;
  document.getElementById('search-input')?.addEventListener('input', (e: any) => {
    store.getState().setSearchQuery(e.target.value);
  });
  document.getElementById('search-btn')?.addEventListener('click', () => {
    if (st.searchQuery) handleSearch(st.searchQuery);
  });
  document.getElementById('search-input')?.addEventListener('keydown', (e: any) => {
    if (e.key === 'Enter' && st.searchQuery) handleSearch(st.searchQuery);
  });
}

async function handleSearch(q: string) {
  const key = q.toLowerCase().trim();
  const curated = CURATED_CITIES[key];
  if (curated) {
    const vs = {
      latitude: curated.lat,
      longitude: curated.lon,
      zoom: curated.zoom,
      bearing: 0,
      pitch: 0,
      transitionDuration: 2000,
      transitionInterpolator: new FlyToInterpolator(),
    };
    store.getState().setTransitioning(true);
    store.getState().setViewState(vs as any);
    deck.setProps({ viewState: vs as any });
    setTimeout(() => store.getState().setTransitioning(false), 2500);
    return;
  }
  try {
    const res = await searchLocation(q);
    if (res.found && res.result) {
      const vs = {
        latitude: res.result.lat,
        longitude: res.result.lon,
        zoom: res.result.zoom || 5,
        bearing: 0,
        pitch: 0,
        transitionDuration: 2000,
        transitionInterpolator: new FlyToInterpolator(),
      };
      store.getState().setTransitioning(true);
      store.getState().setViewState(vs as any);
      deck.setProps({ viewState: vs as any });
      setTimeout(() => store.getState().setTransitioning(false), 2500);
    }
  } catch (e) {
    console.error('Search failed:', e);
  }
}

function renderIntel() {
  const st = s();
  if (!st.selectedFeature) {
    intelEl.style.display = 'none';
    return;
  }
  intelEl.style.display = 'block';
  const o = st.selectedFeature;
  const lid = st.selectedLayerId;
  let html = '<button class="intel-close" id="intel-close">&times;</button>';
  if (lid === 'earthquakes') {
    html += `
      <div class="intel-section">Terremoto</div>
      <div class="intel-row"><span class="intel-lbl">Magnitud</span><span class="intel-val">${o.magnitude ?? '-'}</span></div>
      <div class="intel-row"><span class="intel-lbl">Profundidad</span><span class="intel-val">${o.depth ?? '-'} km</span></div>
      <div class="intel-row"><span class="intel-lbl">Ubicación</span><span class="intel-val">${o.lat?.toFixed(2)}, ${o.lon?.toFixed(2)}</span></div>
      <div class="intel-row"><span class="intel-lbl">Año</span><span class="intel-val">${o.year ?? '-'}</span></div>
    `;
  } else if (lid === 'cyclones') {
    html += `
      <div class="intel-section">Ciclón</div>
      <div class="intel-row"><span class="intel-lbl">Categoría</span><span class="intel-val">${o.category ?? '-'}</span></div>
      <div class="intel-row"><span class="intel-lbl">Año</span><span class="intel-val">${o.year ?? '-'}</span></div>
    `;
  } else if (lid === 'volcanoes') {
    html += `
      <div class="intel-section">Volcán</div>
      <div class="intel-row"><span class="intel-lbl">Elevación</span><span class="intel-val">${o.elevation ?? '-'} m</span></div>
      <div class="intel-row"><span class="intel-lbl">Estado</span><span class="intel-val">${o.active ? 'Activo' : 'Inactivo'}</span></div>
      <div class="intel-row"><span class="intel-lbl">Año</span><span class="intel-val">${o.year ?? '-'}</span></div>
    `;
  } else if (lid === 'h3') {
    const rs = o.risk_score || 0;
    const kmeans = o.kmeans_cluster;
    const clusterLbl = kmeans !== undefined && kmeans !== null ? st.clusterLabels[kmeans] : null;
    html += `
      <div class="intel-score">
        <div class="intel-score-value" style="color:hsl(${Math.round((1 - rs) * 120)}, 80%, 55%)">${rs.toFixed(3)}</div>
        <div class="intel-score-label">Riesgo</div>
      </div>`;

    if (clusterLbl) {
      html += `
      <div class="intel-section">Perfil del Grupo</div>
      <div class="intel-row" style="flex-direction:column;gap:4px;padding:6px 0">
        <span style="font-size:12px;color:#00D4FF;font-weight:600">💼 Negocios</span>
        <span style="font-size:11px;color:#c8d0dc;line-height:1.4">${clusterLbl.business}</span>
        <span style="font-size:12px;color:#F59E0B;font-weight:600;margin-top:4px">🛟 Humanitario</span>
        <span style="font-size:11px;color:#c8d0dc;line-height:1.4">${clusterLbl.humanitarian}</span>
      </div>`;
    }

    html += `
      <div class="intel-section">Celda</div>
      <div class="intel-row"><span class="intel-lbl">Índice</span><span class="intel-val">${o.h3_index || o.cell_id || '-'}</span></div>
      <div class="intel-row"><span class="intel-lbl">Latitud</span><span class="intel-val">${o.lat?.toFixed(2) || '-'}</span></div>
      <div class="intel-row"><span class="intel-lbl">Longitud</span><span class="intel-val">${o.lon?.toFixed(2) || '-'}</span></div>
      <div class="intel-row"><span class="intel-lbl">Año</span><span class="intel-val">${o.year ?? '-'}</span></div>
      <div class="intel-section">Factores</div>
      <div class="intel-row"><span class="intel-lbl">Terremotos</span><span class="intel-val">${o.n_earthquakes ?? o.eq_count ?? 0}</span></div>
      <div class="intel-row"><span class="intel-lbl">Ciclones</span><span class="intel-val">${o.n_cyclones ?? o.cyclone_count ?? 0}</span></div>
      <div class="intel-row"><span class="intel-lbl">Volcanes</span><span class="intel-val">${o.n_volcanoes ?? o.volcano_count ?? 0}</span></div>
      <details style="margin-top:8px">
        <summary style="font-size:10px;color:#5A6478;cursor:pointer;text-transform:uppercase;letter-spacing:1px">Detalles técnicos</summary>
        <div class="intel-row"><span class="intel-lbl">Grupo K-Means</span><span class="intel-val">${kmeans !== undefined && kmeans !== null ? kmeans : '-'}</span></div>
        <div class="intel-row"><span class="intel-lbl">DBSCAN</span><span class="intel-val">${o.dbscan_label !== undefined && o.dbscan_label !== null ? (o.dbscan_label === -1 ? 'Atípico' : o.dbscan_label) : '-'}</span></div>
        <div class="intel-row"><span class="intel-lbl">PC1</span><span class="intel-val">${o.pc1?.toFixed(3) ?? '-'}</span></div>
      </details>
    `;
  } else {
    html += `<pre style="font-size:11px;color:#8892A4;overflow-x:auto">${JSON.stringify(o, null, 2)}</pre>`;
  }
  intelEl.innerHTML = html;
  document.getElementById('intel-close')?.addEventListener('click', () => {
    store.getState().setSelectedFeature(null, '');
  });
}

function renderTimeline() {
  const st = s();
  const yearRange = st.timelineYear - 2000;
  const pct = Math.round((yearRange / 26) * 100);
  timelineEl.innerHTML = `
    <div class="timeline-inner">
      <span class="timeline-label">Línea de tiempo</span>
      <input type="range" class="timeline-slider" min="2000" max="2026" value="${st.timelineYear}" step="1" />
      <span class="timeline-year">${st.timelineYear}</span>
      <span class="timeline-badge">${pct}% del período</span>
    </div>
  `;
  timelineEl.querySelector('.timeline-slider')?.addEventListener('input', (e: any) => {
    store.getState().setTimelineYear(parseInt(e.target.value));
    updateFilteredLayers();
  });
}

function renderSidebar() {
  const st = s();
  if (!st.sidebarOpen) {
    sidebarEl.innerHTML = '<button class="sidebar-toggle" id="sidebar-open">&#x2630;</button>';
    document.getElementById('sidebar-open')?.addEventListener('click', () => {
      store.getState().setSidebarOpen(true);
    });
    return;
  }

  let rankItems: string;
  if (st.rankingLoading) {
    rankItems = Array.from({ length: 5 }, (_, i) =>
      `<div class="ranking-item ranking-skeleton"><span class="ranking-pos">${i + 1}.</span><span class="ranking-name skeleton-line"></span><span class="ranking-score skeleton-line skeleton-short"></span></div>`
    ).join('');
  } else if (st.hotspotRanking.length) {
    rankItems = st.hotspotRanking.map((r: any, i: number) =>
      `<div class="ranking-item" data-index="${i}">
        <span class="ranking-pos">${i + 1}.</span>
        <div class="ranking-info">
          <span class="ranking-name">${r.region || r.cell_id?.substring(0, 8) || 'Zone ' + (i + 1)}</span>
          <span class="ranking-factors">TER:${r.n_earthquakes ?? '-'} · CIC:${r.n_cyclones ?? '-'} · VOL:${r.n_volcanoes ?? '-'}</span>
        </div>
        <span class="ranking-score" style="color:hsl(${Math.round((1 - (r.risk_score || 0)) * 120)}, 80%, 55%)">${(r.risk_score || 0).toFixed(3)}</span>
      </div>`
    ).join('');
  } else {
    rankItems = '<div class="ranking-empty">Sin zonas destacadas</div>';
  }

  const activeTypes = st.filters.activeTypes;
  sidebarEl.innerHTML = `
    <div class="sidebar-header">
      <span>Zonas Destacadas</span>
      <button class="sidebar-toggle" id="sidebar-close">&times;</button>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Top ${st.hotspotRanking.length || (st.rankingLoading ? '...' : '0')} por Riesgo</div>
      <div class="ranking-list">${rankItems}</div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Tipo de Evento</div>
      <label class="toggle-row"><input type="checkbox" class="event-type-cb" data-type="earthquakes" ${activeTypes.includes('earthquakes') ? 'checked' : ''} /><span class="toggle-label">Terremotos</span></label>
      <label class="toggle-row"><input type="checkbox" class="event-type-cb" data-type="cyclones" ${activeTypes.includes('cyclones') ? 'checked' : ''} /><span class="toggle-label">Ciclones</span></label>
      <label class="toggle-row"><input type="checkbox" class="event-type-cb" data-type="volcanoes" ${activeTypes.includes('volcanoes') ? 'checked' : ''} /><span class="toggle-label">Volcanes</span></label>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Riesgo por Zona</div>
      <div class="filter-row">
        <label>Riesgo mín.</label>
        <input type="range" min="0" max="1" step="0.05" value="${st.filters.minRisk}" class="filter-slider" data-filter="minRisk" />
        <span class="filter-val">${st.filters.minRisk.toFixed(2)}</span>
      </div>
      <div style="font-size:10px;color:#5A6478;margin-top:-2px">${(() => { const h3 = rawDataCache['h3'] || []; const total = h3.length; const passing = h3.filter((d:any) => d.risk_score >= st.filters.minRisk).length; return `${passing.toLocaleString()} / ${total.toLocaleString()} zonas`; })()}</div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Terremotos Individuales</div>
      <div class="filter-row">
        <label>Magnitud mín.</label>
        <input type="range" min="0" max="9.5" step="0.1" value="${st.filters.minMagnitude}" class="filter-slider" data-filter="minMagnitude" />
        <span class="filter-val">${st.filters.minMagnitude.toFixed(1)}</span>
      </div>
      <div class="filter-row">
        <label>Profundidad máx.</label>
        <input type="range" min="0" max="700" step="10" value="${st.filters.maxDepth}" class="filter-slider" data-filter="maxDepth" />
        <span class="filter-val">${st.filters.maxDepth}km</span>
      </div>
      <div style="font-size:10px;color:#5A6478;margin-top:-2px">${(() => { const eq = rawDataCache['earthquakes'] || []; const total = eq.length; const passing = eq.filter((d:any) => (d.magnitude ?? 0) >= st.filters.minMagnitude && (d.depth ?? Infinity) <= st.filters.maxDepth).length; return `${passing.toLocaleString()} / ${total.toLocaleString()} eventos`; })()}</div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Visualización</div>
      <label class="toggle-row"><input type="checkbox" id="cluster-toggle" ${st.clusterColoring ? 'checked' : ''} /><span class="toggle-label">Colorear por grupo</span></label>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Leyenda</div>
      ${st.clusterColoring
        ? (() => {
            const cls = st.clusterLabels;
            const palette = ['#3B82F6','#EF4444','#10B981','#F59E0B','#8B5CF6','#EC4899','#22D3EE','#FB923C','#84CC16','#A855F7'];
            return Object.keys(cls).length
              ? Object.entries(cls).map(([id, lbl]: any) =>
                  `<div class="legend-row"><span class="legend-dot" style="background:${palette[Number(id) % palette.length]}"></span>Grupo ${id}: ${lbl.business?.substring(0, 40)}...</div>`
                ).join('')
              : `<div class="legend-row"><span class="legend-dot" style="background:#3B82F6"></span>Grupo 0</div>
                 <div class="legend-row"><span class="legend-dot" style="background:#EF4444"></span>Grupo 1</div>
                 <div class="legend-row"><span class="legend-dot" style="background:#10B981"></span>Grupo 2</div>
                 <div class="legend-row"><span class="legend-dot" style="background:#F59E0B"></span>Grupo 3</div>
                 <div class="legend-row"><span class="legend-dot" style="background:#8B5CF6"></span>Grupo 4+</div>`;
          })()
        : `<div class="legend-row"><span class="legend-dot" style="background:#10B981"></span>Bajo riesgo</div>
           <div class="legend-row"><span class="legend-dot" style="background:#F59E0B"></span>Riesgo medio</div>
           <div class="legend-row"><span class="legend-dot" style="background:#EF4444"></span>Alto riesgo</div>`
      }
    </div>
  `;
  document.getElementById('sidebar-close')?.addEventListener('click', () => {
    store.getState().setSidebarOpen(false);
  });
  let filterTimer: any = null;
  sidebarEl.querySelectorAll('.filter-slider').forEach((el: any) => {
    el.addEventListener('input', () => {
      store.getState().setFilters({ [el.dataset.filter]: parseFloat(el.value) });
      if (filterTimer) clearTimeout(filterTimer);
      filterTimer = setTimeout(() => updateFilteredLayers(), 120);
    });
  });
  sidebarEl.querySelectorAll('.event-type-cb').forEach((el: any) => {
    el.addEventListener('change', () => {
      const type = el.dataset.type as string;
      const current = store.getState().filters.activeTypes;
      const next = el.checked
        ? [...current, type]
        : current.filter((t: string) => t !== type);
      store.getState().setFilters({ activeTypes: next });
      updateFilteredLayers();
    });
  });
  const clusterToggle = document.getElementById('cluster-toggle');
  if (clusterToggle) {
    clusterToggle.addEventListener('change', (e: any) => {
      store.getState().setClusterColoring(e.target.checked);
      updateFilteredLayers();
    });
  }
  sidebarEl.querySelectorAll('.ranking-item').forEach((el: any) => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      const r = st.hotspotRanking[idx];
      if (!r) return;
      const vs = {
        latitude: r.lat,
        longitude: r.lon,
        zoom: 5,
        bearing: 0,
        pitch: 0,
        transitionDuration: 1500,
        transitionInterpolator: new FlyToInterpolator(),
      };
      store.getState().setTransitioning(true);
      store.getState().setViewState(vs as any);
      deck.setProps({ viewState: vs as any });
      store.getState().setSelectedFeature(r, 'h3');
      setTimeout(() => store.getState().setTransitioning(false), 2000);
    });
  });
}

function render() {
  const st = s();
  if (!st.loading && loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
  renderTopbar();
  renderSidebar();
  renderIntel();
  renderTimeline();
}

sub(render);
render();
