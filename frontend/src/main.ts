import { Deck, _GlobeView as GlobeView, FlyToInterpolator } from '@deck.gl/core';
import { store } from './store';
import { fetchLayers, searchLocation, fetchRanking } from './api';
import { loadContinentPolygons, createBaseMapLayer, createDataLayers, createHeatmapLayer } from './layers';

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
let totalRealEvents = 0;

function updateFilteredLayers() {
  const filters = store.getState().filters;
  const rawLayers = store.getState().rawLayers;

  const filteredDescriptors = rawLayers.map((desc: any) => {
    const rawData = rawDataCache[desc.id] || [];
    let filteredData = rawData;

    if (desc.id === 'h3') {
      filteredData = rawData.filter((d: any) => d.risk_score >= filters.minRisk);
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
  const allLayers = [base, ...dataLayers, heatmap];
  deck.setProps({ layers: allLayers });
}

function computeVisibleCount(): number {
  const layers = (deck.props.layers || []) as any[];
  let count = 0;
  for (const l of layers) {
    if (!l || l.id === 'land' || l.id === 'risk-heatmap' || l.id === 'graticule' || l.id === 'plates') continue;
    count += l.props?.data?.length || 0;
  }
  return count;
}

function computeFilteredCount(): number {
  let count = 0;
  for (const [id, data] of Object.entries(rawDataCache)) {
    if (id === 'graticule' || id === 'plates') continue;
    count += (data as any[]).length;
  }
  return count;
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
    totalRealEvents = computeFilteredCount();
    store.getState().setRawLayers(res.layers);
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
        <input type="text" id="search-input" placeholder="Search city, region..." value="${st.searchQuery}" />
        <button id="search-btn">&#x1F50D;</button>
      </div>
      <div class="topbar-stats">
        <span>${visible.toLocaleString()} / ${total.toLocaleString()} events</span>
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
      <div class="intel-section">Earthquake</div>
      <div class="intel-row"><span class="intel-lbl">Magnitude</span><span class="intel-val">${o.magnitude ?? '-'}</span></div>
      <div class="intel-row"><span class="intel-lbl">Depth</span><span class="intel-val">${o.depth ?? '-'} km</span></div>
      <div class="intel-row"><span class="intel-lbl">Location</span><span class="intel-val">${o.lat?.toFixed(2)}, ${o.lon?.toFixed(2)}</span></div>
      <div class="intel-row"><span class="intel-lbl">Year</span><span class="intel-val">${o.year ?? '-'}</span></div>
    `;
  } else if (lid === 'cyclones') {
    html += `
      <div class="intel-section">Cyclone Track</div>
      <div class="intel-row"><span class="intel-lbl">Category</span><span class="intel-val">${o.category ?? '-'}</span></div>
      <div class="intel-row"><span class="intel-lbl">Year</span><span class="intel-val">${o.year ?? '-'}</span></div>
    `;
  } else if (lid === 'volcanoes') {
    html += `
      <div class="intel-section">Volcano</div>
      <div class="intel-row"><span class="intel-lbl">Elevation</span><span class="intel-val">${o.elevation ?? '-'} m</span></div>
      <div class="intel-row"><span class="intel-lbl">Status</span><span class="intel-val">${o.active ? 'Active' : 'Inactive'}</span></div>
      <div class="intel-row"><span class="intel-lbl">Year</span><span class="intel-val">${o.year ?? '-'}</span></div>
    `;
  } else if (lid === 'h3') {
    const rs = o.risk_score || 0;
    const kmeans = o.kmeans_cluster;
    const dbscan = o.dbscan_label;
    html += `
      <div class="intel-score">
        <div class="intel-score-value" style="color:hsl(${Math.round((1 - rs) * 120)}, 80%, 55%)">${rs.toFixed(3)}</div>
        <div class="intel-score-label">Risk Score</div>
      </div>
      <div class="intel-section">H3 Cell</div>
      <div class="intel-row"><span class="intel-lbl">Index</span><span class="intel-val">${o.h3_index || o.cell_id || '-'}</span></div>
      <div class="intel-row"><span class="intel-lbl">K-Means</span><span class="intel-val">${kmeans !== undefined && kmeans !== null ? 'Cluster ' + kmeans : '-'}</span></div>
      <div class="intel-row"><span class="intel-lbl">DBSCAN</span><span class="intel-val">${dbscan !== undefined && dbscan !== null ? (dbscan === -1 ? 'Noise (atípico)' : 'Cluster ' + dbscan) : '-'}</span></div>
      <div class="intel-row"><span class="intel-lbl">Latitude</span><span class="intel-val">${o.lat?.toFixed(2) || '-'}</span></div>
      <div class="intel-row"><span class="intel-lbl">Longitude</span><span class="intel-val">${o.lon?.toFixed(2) || '-'}</span></div>
      <div class="intel-section">Factors</div>
      <div class="intel-row"><span class="intel-lbl">Earthquakes</span><span class="intel-val">${o.n_earthquakes ?? o.eq_count ?? 0}</span></div>
      <div class="intel-row"><span class="intel-lbl">Cyclones</span><span class="intel-val">${o.n_cyclones ?? o.cyclone_count ?? 0}</span></div>
      <div class="intel-row"><span class="intel-lbl">Volcanoes</span><span class="intel-val">${o.n_volcanoes ?? o.volcano_count ?? 0}</span></div>
      <div class="intel-row"><span class="intel-lbl">PC1</span><span class="intel-val">${o.pc1?.toFixed(3) ?? '-'}</span></div>
      <div class="intel-row"><span class="intel-lbl">Year</span><span class="intel-val">${o.year ?? '-'}</span></div>
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
  timelineEl.innerHTML = `
    <div class="timeline-inner">
      <span class="timeline-label">Timeline</span>
      <input type="range" class="timeline-slider" min="2000" max="2026" value="${st.timelineYear}" step="1" />
      <span class="timeline-year">${st.timelineYear}</span>
      <span class="timeline-badge">Proximamente</span>
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
          <span class="ranking-factors">EQ:${r.n_earthquakes ?? '-'} · CYC:${r.n_cyclones ?? '-'} · VOL:${r.n_volcanoes ?? '-'}</span>
        </div>
        <span class="ranking-score" style="color:hsl(${Math.round((1 - (r.risk_score || 0)) * 120)}, 80%, 55%)">${(r.risk_score || 0).toFixed(3)}</span>
      </div>`
    ).join('');
  } else {
    rankItems = '<div class="ranking-empty">No hotspots found</div>';
  }

  sidebarEl.innerHTML = `
    <div class="sidebar-header">
      <span>Hotspot Ranking</span>
      <button class="sidebar-toggle" id="sidebar-close">&times;</button>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Top ${st.hotspotRanking.length || (st.rankingLoading ? '...' : '0')} by Risk Score</div>
      <div class="ranking-list">${rankItems}</div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Filters</div>
      <div class="filter-row">
        <label>Min Risk</label>
        <input type="range" min="0" max="1" step="0.05" value="${st.filters.minRisk}" class="filter-slider" data-filter="minRisk" />
        <span class="filter-val">${st.filters.minRisk.toFixed(2)}</span>
      </div>
      <div class="filter-row">
        <label>Min Mag.</label>
        <input type="range" min="0" max="9.5" step="0.1" value="${st.filters.minMagnitude}" class="filter-slider" data-filter="minMagnitude" />
        <span class="filter-val">${st.filters.minMagnitude.toFixed(1)}</span>
      </div>
      <div class="filter-row">
        <label>Max Depth</label>
        <input type="range" min="0" max="700" step="10" value="${st.filters.maxDepth}" class="filter-slider" data-filter="maxDepth" />
        <span class="filter-val">${st.filters.maxDepth}km</span>
      </div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Legend</div>
      <div class="legend-row"><span class="legend-dot" style="background:#10B981"></span>Low risk</div>
      <div class="legend-row"><span class="legend-dot" style="background:#F59E0B"></span>Medium risk</div>
      <div class="legend-row"><span class="legend-dot" style="background:#EF4444"></span>High risk</div>
    </div>
  `;
  document.getElementById('sidebar-close')?.addEventListener('click', () => {
    store.getState().setSidebarOpen(false);
  });
  sidebarEl.querySelectorAll('.filter-slider').forEach((el: any) => {
    el.addEventListener('input', () => {
      store.getState().setFilters({ [el.dataset.filter]: parseFloat(el.value) });
      updateFilteredLayers();
    });
  });
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
