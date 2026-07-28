import { Deck, _GlobeView as GlobeView, FlyToInterpolator } from '@deck.gl/core';
import { store } from './store';
import { fetchLayers, searchLocation, fetchRanking } from './api';
import { loadContinentPolygons, createBaseMapLayer, createDataLayers, createHeatmapLayer, createHotspotLabels } from './layers';

const style = document.createElement('style');
style.textContent = `
  /* Escena 1: fade-in círculo punteado (0-0.4s) */
  @keyframes scene1 {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  #geo-circle-1 { animation: scene1 0.4s ease-out forwards; }

  /* Escena 2: nodos en secuencia (0.4-1.1s) */
  @keyframes nodeAppear {
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1); }
  }
  
  #geo-node-1 { animation: nodeAppear 150ms ease-out 0.4s forwards; }
  #geo-node-2 { animation: nodeAppear 150ms ease-out 0.55s forwards; }
  #geo-node-3 { animation: nodeAppear 150ms ease-out 0.7s forwards; }
  #geo-node-4 { animation: nodeAppear 150ms ease-out 0.85s forwards; }

  /* Escena 3: líneas dibujándose (1.1-1.8s) */
  @keyframes drawLine {
    from { stroke-dashoffset: 1; }
    to { stroke-dashoffset: 0; }
  }
  
  #geo-line-1, #geo-line-2, #geo-line-3, #geo-line-4 {
    stroke-dasharray: 500;
    stroke-dashoffset: 500;
    animation: drawLine 400ms ease-out 1.1s forwards;
  }

  /* Escena 4: texto GeoRisk aparece (1.8-2.4s) */
  @keyframes revealGeoRisk {
    from { opacity: 0; transform: translateX(12px); }
    to { opacity: 1; transform: translateX(0); }
  }
  #geo-text-geo { 
    opacity: 0;
    animation: revealGeoRisk 300ms ease-out 1.8s forwards;
  }

  /* Escena 5: texto FINDER aparece (2.4-3.0s) */
  @keyframes revealFinder {
    from { 
      opacity: 0; 
      clip-path: inset(0 100% 0 0);
    }
    to { 
      opacity: 1; 
      clip-path: inset(0 0 0 0);
    }
  }
  #geo-text-find { 
    opacity: 0; 
    clip-path: inset(0 100% 0 0); 
    animation: revealFinder 300ms ease-out 2.4s forwards;
    fill: #17c896;
  }

  /* Pulso opcional cada 8s (3.8s → 7.8s) */
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.03); }
  }
  .pulse { animation: pulse 400ms ease-in-out 3.8s 3 forwards; }

  .logo-container {
    position: relative;
    cursor: pointer;
    transition: transform 0.3s ease;
  }
  
  .logo-container:hover {
    transform: scale(1.05);
  }
`;
document.head.appendChild(style);

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

const REGIONS: { name: string; w: number; e: number; s: number; n: number }[] = [
  { name: 'Japón', w: 130, e: 146, s: 30, n: 46 },
  { name: 'Filipinas', w: 116, e: 128, s: 4, n: 21 },
  { name: 'Indonesia', w: 95, e: 142, s: -11, n: 6 },
  { name: 'Chile', w: -76, e: -66, s: -56, n: -18 },
  { name: 'Perú', w: -82, e: -68, s: -19, n: 0 },
  { name: 'México', w: -118, e: -86, s: 14, n: 33 },
  { name: 'Centroamérica', w: -93, e: -77, s: 7, n: 19 },
  { name: 'California', w: -125, e: -114, s: 32, n: 42 },
  { name: 'Alaska', w: -170, e: -130, s: 51, n: 72 },
  { name: 'Anillo del Pacífico', w: 120, e: -70, s: -60, n: 60 },
  { name: 'Caribe', w: -90, e: -60, s: 8, n: 28 },
  { name: 'Mediterráneo', w: -10, e: 40, s: 30, n: 48 },
  { name: 'Oriente Medio', w: 35, e: 60, s: 12, n: 42 },
  { name: 'Himalaya', w: 72, e: 98, s: 26, n: 38 },
  { name: 'Nueva Zelanda', w: 166, e: 179, s: -48, n: -34 },
  { name: 'Islandia', w: -25, e: -15, s: 63, n: 67 },
  { name: 'Rift de África Oriental', w: 29, e: 42, s: -20, n: 5 },
  { name: 'India', w: 68, e: 98, s: 6, n: 36 },
  { name: 'China', w: 73, e: 136, s: 18, n: 54 },
  { name: 'Rusia', w: 30, e: 180, s: 45, n: 72 },
  { name: 'Europa', w: -10, e: 40, s: 36, n: 60 },
  { name: 'Sudamérica', w: -82, e: -34, s: -56, n: 12 },
  { name: 'Norteamérica', w: -130, e: -60, s: 24, n: 50 },
  { name: 'Australia', w: 112, e: 155, s: -44, n: -10 },
  { name: 'África', w: -20, e: 52, s: -36, n: 38 },
];

function regionFromCoords(lat: number, lon: number): string {
  for (const r of REGIONS) {
    if (r.w <= r.e) {
      if (r.w <= lon && lon <= r.e && r.s <= lat && lat <= r.n) return r.name;
    } else {
      if ((lon >= r.w || lon <= r.e) && r.s <= lat && lat <= r.n) return r.name;
    }
  }
  return '—';
}

const CURATED_CITIES: Record<string, { label: string }> = {
  'madrid': { label: 'Madrid, España' },
  'tokio': { label: 'Tokio, Japón' },
  'japon': { label: 'Japón' },
  'chile': { label: 'Chile' },
  'indonesia': { label: 'Indonesia' },
  'california': { label: 'California, EE.UU.' },
  'valencia': { label: 'Valencia, España' },
  'venezuela': { label: 'Venezuela' },
  'espana': { label: 'España' },
  'canarias': { label: 'Canarias, España' },
  'manila': { label: 'Manila, Filipinas' },
  'yakarta': { label: 'Yakarta, Indonesia' },
  'katmandu': { label: 'Katmandú, Nepal' },
  'estambul': { label: 'Estambul, Turquía' },
  'napoles': { label: 'Nápoles, Italia' },
  'san francisco': { label: 'San Francisco, EE.UU.' },
  'santiago': { label: 'Santiago, Chile' },
  'caracas': { label: 'Caracas, Venezuela' },
  'lima': { label: 'Lima, Perú' },
  'bogota': { label: 'Bogotá, Colombia' },
  'port-au-prince': { label: 'Puerto Príncipe, Haití' },
  'mexico': { label: 'México' },
  'colombia': { label: 'Colombia' },
  'peru': { label: 'Perú' },
  'filipinas': { label: 'Filipinas' },
  'nepal': { label: 'Nepal' },
};

function filterCities(query: string): { key: string; label: string }[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: { key: string; label: string }[] = [];
  for (const [key, v] of Object.entries(CURATED_CITIES)) {
    if (key.includes(q) || v.label.toLowerCase().includes(q)) {
      results.push({ key, label: v.label });
      if (results.length >= 5) break;
    }
  }
  return results;
}

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
      // PASO 5: logear CLUSTER_LABELS con medias
      console.table(Object.entries(clusterLabels).map(([c, l]) => ({
        cluster: c,
        eq_mean: Math.round(l.eq * 100) / 100,
        cyc_mean: Math.round(l.cyc * 100) / 100,
        vol_mean: Math.round(l.vol * 100) / 100,
        risk_mean: Math.round(l.risk * 10000) / 100,
        count: l.count,
        business: l.business,
        humanitarian: l.humanitarian,
      })));
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
      <div class="logo-container">
        <div class="logo-svg-wrapper">
          <div class="logo-svg">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 896 268">
              <rect id="geo-bg" width="896" height="268" fill="#061533" style="opacity: 0;" />
              <circle id="geo-circle-1" cx="125" cy="126" r="63" fill="none" 
                      stroke="#2f436d" stroke-width="4" stroke-dasharray="8 8"/>
              <line id="geo-line-1" x1="90" y1="98" x2="153" y2="90" stroke="#dfe7f7" 
                    stroke-width="5" stroke-linecap="round"/>
              <line id="geo-line-2" x1="90" y1="98" x2="105" y2="165" stroke="#dfe7f7" 
                    stroke-width="5" stroke-linecap="round"/>
              <line id="geo-line-3" x1="153" y1="90" x2="160" y2="155" stroke="#dfe7f7" 
                    stroke-width="5" stroke-linecap="round"/>
              <line id="geo-line-4" x1="105" y1="165" x2="160" y2="155" stroke="#dfe7f7" 
                    stroke-width="5" stroke-linecap="round"/>
              <circle id="geo-node-1" cx="90" cy="98" r="14" fill="#16c38a"/>
              <circle id="geo-node-2" cx="153" cy="90" r="14" fill="#18b8e8"/>
              <circle id="geo-node-3" cx="105" cy="165" r="14" fill="#16c38a"/>
              <circle id="geo-node-4" cx="160" cy="155" r="20" fill="#ff5b5f"/>
              <text id="geo-text-geo" x="255" y="140" font-family="Arial, Helvetica, sans-serif" 
                    font-size="78" font-weight="700" fill="#f3f3f3" text-anchor="start"
                    dominant-baseline="middle">GeoRisk</text>
              <text id="geo-text-find" x="575" y="140" font-family="Arial, Helvetica, sans-serif" 
                    font-size="78" font-weight="400" text-anchor="start" 
                    dominant-baseline="middle">FINDER</text>
            </svg>
          </div>
        </div>
        <div class="app-title">Finder</div>
      </div>
      <div class="search-wrapper">
        <div class="search-box">
          <input type="text" id="search-input" placeholder="Buscar ciudad, región..." value="${st.searchQuery}" autocomplete="off" />
          <button id="search-btn">&times;</button>
        </div>
        <div class="search-suggestions" id="search-suggestions"></div>
      </div>
      <div class="topbar-stats">
        <span>${visible.total.toLocaleString()} / ${total.total.toLocaleString()} eventos</span>
        <span title="Terremotos">TER ${visible.eq.toLocaleString()}</span>
        <span title="Ciclones">CIC ${visible.cyc.toLocaleString()}</span>
        <span title="Volcanes">VOL ${visible.vol.toLocaleString()}</span>
      </div>
    </div>
  `;
  const input = document.getElementById('search-input') as HTMLInputElement;
  const suggestionsEl = document.getElementById('search-suggestions')!;
  input?.addEventListener('input', (e: any) => {
    const q = e.target.value;
    store.getState().setSearchQuery(q);
    const results = filterCities(q);
    if (results.length) {
      suggestionsEl.innerHTML = results.map((r, i) =>
        `<div class="search-suggestion-item" data-key="${r.key}" data-idx="${i}">${r.label}<div class="search-suggestion-region">${r.key}</div></div>`
      ).join('');
      suggestionsEl.style.display = 'block';
    } else {
      suggestionsEl.style.display = 'none';
    }
  });
  input?.addEventListener('keydown', (e: any) => {
    if (e.key === 'Enter' && st.searchQuery) {
      suggestionsEl.style.display = 'none';
      handleSearch(st.searchQuery);
    }
    if (e.key === 'Escape') suggestionsEl.style.display = 'none';
  });
  input?.addEventListener('blur', () => {
    setTimeout(() => { suggestionsEl.style.display = 'none'; }, 200);
  });
  suggestionsEl.addEventListener('click', (e: any) => {
    const item = e.target.closest('.search-suggestion-item');
    if (item) {
      const key = item.dataset.key;
      suggestionsEl.style.display = 'none';
      if (input) input.value = key;
      store.getState().setSearchQuery(key);
      handleSearch(key);
    }
  });
  document.getElementById('search-btn')?.addEventListener('click', () => {
    suggestionsEl.style.display = 'none';
    if (input) { input.value = ''; store.getState().setSearchQuery(''); }
  });
}

async function handleSearch(q: string) {
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
    const regionName = regionFromCoords(o.lat, o.lon);
    html += `
      <div class="intel-section">Región</div>
      <div class="intel-row"><span class="intel-lbl">Nombre</span><span class="intel-val">${regionName}</span></div>
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
        <span style="font-size:floatsize:12px;color:#F59E0B;font-weight:600;margin-top:4px">🛟 Humanitario</span>
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
