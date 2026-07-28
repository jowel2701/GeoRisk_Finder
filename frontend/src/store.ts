import { createStore } from 'zustand/vanilla';
import type { Layer } from '@deck.gl/core';

export interface ViewState {
  latitude: number;
  longitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
  transitionDuration?: number;
  transitionInterpolator?: unknown;
}

export interface FilterState {
  minRisk: number;
  minMagnitude: number;
  maxDepth: number;
  yearRange: [number, number];
  activeTypes: string[];
  minOverlap: number;
}

export interface ClusterLabel {
  business: string;
  humanitarian: string;
  eq: number;
  cyc: number;
  vol: number;
  risk: number;
}

export interface AppState {
  // Deck
  deckInstance: any;
  viewState: ViewState;
  transitioning: boolean;

  // Data
  layers: any[];
  rawLayers: any[];
  selectedFeature: any;
  selectedLayerId: string;
  hotspotRanking: any[];
  loading: boolean;
  rankingLoading: boolean;

  // UI
  sidebarOpen: boolean;
  intelOpen: boolean;
  filters: FilterState;
  timelineYear: number;
  searchQuery: string;
  searchResults: any[];
  clusterColoring: boolean;
  clusterLabels: Record<number, ClusterLabel>;

  // Actions
  setDeckInstance: (d: any) => void;
  setViewState: (vs: ViewState) => void;
  updateViewState: (vs: Partial<ViewState>) => void;
  setTransitioning: (t: boolean) => void;
  setRawLayers: (l: any[]) => void;
  setSelectedFeature: (f: any, layerId: string) => void;
  setHotspotRanking: (r: any[]) => void;
  setRankingLoading: (l: boolean) => void;
  setLoading: (l: boolean) => void;
  setSidebarOpen: (o: boolean) => void;
  setIntelOpen: (o: boolean) => void;
  setFilters: (f: Partial<FilterState>) => void;
  setTimelineYear: (y: number) => void;
  setSearchQuery: (q: string) => void;
  setSearchResults: (r: any[]) => void;
  setClusterColoring: (v: boolean) => void;
  setClusterLabels: (l: Record<number, ClusterLabel>) => void;
  getFilteredLayers: () => any[];
}

const defaultFilters: FilterState = {
  minRisk: 0,
  minMagnitude: 0,
  maxDepth: 700,
  yearRange: [2000, 2026],
  activeTypes: ['h3', 'earthquakes', 'cyclones', 'volcanoes'],
  minOverlap: 0,
};

export const store = createStore<AppState>((set, get) => ({
  deckInstance: null,
  viewState: { latitude: 15, longitude: 0, zoom: 1.5, bearing: 0, pitch: 0 },
  transitioning: false,

  layers: [],
  rawLayers: [],
  selectedFeature: null,
  selectedLayerId: '',
  hotspotRanking: [],
  loading: true,
  rankingLoading: true,

  sidebarOpen: true,
  intelOpen: false,
  filters: { ...defaultFilters },
  timelineYear: 2026,
  searchQuery: '',
  searchResults: [],
  clusterColoring: false,
  clusterLabels: {},

  setDeckInstance: (d) => set({ deckInstance: d }),
  setViewState: (vs) => set({ viewState: vs }),
  updateViewState: (vs) => set((s) => ({ viewState: { ...s.viewState, ...vs } })),
  setTransitioning: (t) => set({ transitioning: t }),
  setRawLayers: (l) => set({ rawLayers: l }),
  setSelectedFeature: (f, lid) => set({ selectedFeature: f, selectedLayerId: lid, intelOpen: !!f }),
  setHotspotRanking: (r) => set({ hotspotRanking: r, rankingLoading: false }),
  setRankingLoading: (l) => set({ rankingLoading: l }),
  setLoading: (l) => set({ loading: l }),
  setSidebarOpen: (o) => set({ sidebarOpen: o }),
  setIntelOpen: (o) => set({ intelOpen: o }),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  setTimelineYear: (y) => set({ timelineYear: y }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchResults: (r) => set({ searchResults: r }),
  setClusterColoring: (v) => set({ clusterColoring: v }),
  setClusterLabels: (l) => set({ clusterLabels: l }),
  getFilteredLayers: () => {
    const s = get();
    return s.rawLayers.filter((l: any) => s.filters.activeTypes.includes(l.id));
  },
}));
