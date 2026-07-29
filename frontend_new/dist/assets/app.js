// GeoRisk Finder - Clean Frontend
// Addresses: working map, removable markers, proper UI

let map;
let markers = [];
let defaultMarkers = [];
let rankingData = [];
let selectedCell = null;
let showDefaultMarkers = true;
let minRiskScore = 0.3;
let activeHazards = { earthquakes: true, cyclones: true, volcanoes: true };

const API_BASE = '/api';

// Initialize the app
async function init() {
    // Initialize map
    initMap();
    
    // Load data
    await loadRanking();
    await loadLayers();
    
    // Setup event listeners
    setupEventListeners();
    
    // Hide loading
    document.getElementById('loading-overlay').style.display = 'none';
}

function initMap() {
    map = L.map('map', {
        center: [20, 0],
        zoom: 2,
        minZoom: 1,
        maxZoom: 10,
        scrollWheelZoom: true,
        zoomControl: true,
    });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 10,
    }).addTo(map);
}

async function loadRanking() {
    try {
        const response = await fetch(`${API_BASE}/ranking?limit=50`);
        rankingData = await response.json();
        renderRanking(rankingData);
    } catch (error) {
        console.error('Failed to load ranking:', error);
        document.getElementById('ranking-list').innerHTML = '<div class="ranking-item">Error loading data</div>';
    }
}

async function loadLayers() {
    try {
        const response = await fetch(`${API_BASE}/layers`);
        const data = await response.json();
        
        // Add view state if available
        if (data.view_state) {
            map.setView([data.view_state.latitude, data.view_state.longitude], data.view_state.zoom);
        }
        
        // Process layers
        if (data.layers) {
            data.layers.forEach(layer => {
                if (layer.data && layer.data.length > 0) {
                    addLayerToMap(layer);
                }
            });
        }
    } catch (error) {
        console.error('Failed to load layers:', error);
    }
}

function addLayerToMap(layer) {
    if (layer.id === 'h3' || layer.id === 'hotspots') {
        layer.data.forEach(item => {
            if (item.risk_score >= minRiskScore) {
                addRiskMarker(item);
            }
        });
    }
}

function addRiskMarker(item) {
    const riskScore = item.risk_score || 0;
    const hue = Math.round((1 - riskScore) * 120);
    const color = `hsl(${hue}, 80%, 55%)`;
    
    const marker = L.circleMarker([item.lat, item.lon], {
        radius: 8,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
    });
    
    const popupContent = `
        <h4>Risk Cell ${item.cell_id?.substring(0, 8) || 'Unknown'}</h4>
        <div class="intel-row"><span class="intel-lbl">Risk Score</span><span class="intel-val">${riskScore.toFixed(3)}</span></div>
        <div class="intel-row"><span class="intel-lbl">Earthquakes</span><span class="intel-val">${item.n_earthquakes || 0}</span></div>
        <div class="intel-row"><span class="intel-lbl">Cyclones</span><span class="intel-val">${item.n_cyclones || 0}</span></div>
        <div class="intel-row"><span class="intel-lbl">Volcanoes</span><span class="intel-val">${item.n_volcanoes || 0}</span></div>
        ${item.business ? `<div class="intel-row"><span class="intel-lbl">Business</span><span class="intel-val">${item.business}</span></div>` : ''}
    `;
    
    marker.bindPopup(popupContent);
    marker.on('click', () => {
        selectCell(item);
    });
    
    marker.addTo(map);
    markers.push(marker);
}

function addDefaultMarkers() {
    const regions = [
        { name: 'Japón', lat: 38, lon: 138 },
        { name: 'Chile', lat: -33, lon: -71 },
        { name: 'Indonesia', lat: -2, lon: 115 },
        { name: 'Filipinas', lat: 13, lon: 122 },
        { name: 'Perú', lat: -12, lon: -77 },
        { name: 'México', lat: 23, lon: -102 },
        { name: 'California', lat: 37, lon: -120 },
        { name: 'Alaska', lat: 61, lon: -150 },
        { name: 'Caribe', lat: 18, lon: -77 },
        { name: 'Mediterráneo', lat: 38, lon: 15 },
        { name: 'Himalaya', lat: 28, lon: 85 },
        { name: 'Nueva Zelanda', lat: -41, lon: 174 },
        { name: 'España', lat: 40, lon: -3 },
        { name: 'Canarias', lat: 28, lon: -15 },
        { name: 'Venezuela', lat: 10, lon: -67 },
    ];
    
    regions.forEach(region => {
        const marker = L.marker([region.lat, region.lon], {
            icon: L.divIcon({
                className: 'default-marker',
                html: `<div class="marker-icon" style="background: #20808D; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">${region.name}</div>`,
                className: 'region-marker',
            }),
        });
        
        marker.bindPopup(`<h4>${region.name}</h4><p>Default region marker</p>`);
        marker.addTo(map);
        defaultMarkers.push(marker);
    });
}

function clearAllMarkers() {
    // Clear risk markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    
    // Clear default markers
    defaultMarkers.forEach(m => map.removeLayer(m));
    defaultMarkers = [];
    showDefaultMarkers = false;
    
    // Update checkbox
    document.getElementById('show-default-markers').checked = false;
}

function toggleDefaultMarkers() {
    showDefaultMarkers = document.getElementById('show-default-markers').checked;
    
    if (showDefaultMarkers) {
        if (defaultMarkers.length === 0) {
            addDefaultMarkers();
        }
    } else {
        defaultMarkers.forEach(m => map.removeLayer(m));
        defaultMarkers = [];
    }
}

function renderRanking(data) {
    const list = document.getElementById('ranking-list');
    list.innerHTML = '';
    
    data.forEach((item, index) => {
        const riskScore = item.risk_score || 0;
        const hue = Math.round((1 - riskScore) * 120);
        const color = `hsl(${hue}, 80%, 55%)`;
        
        const div = document.createElement('div');
        div.className = 'ranking-item';
        div.innerHTML = `
            <div class="ranking-pos">${index + 1}.</div>
            <div class="ranking-name">${item.region || item.cell_id?.substring(0, 8) || 'Zone ' + (index + 1)}</div>
            <div class="ranking-score" style="color: ${color}">${riskScore.toFixed(3)}</div>
            <div class="ranking-factors">TER: ${item.n_earthquakes || 0} | CIC: ${item.n_cyclones || 0} | VOL: ${item.n_volcanoes || 0}</div>
        `;
        div.onclick = () => {
            selectCell(item);
            map.setView([item.lat, item.lon], 5);
        };
        list.appendChild(div);
    });
}

function selectCell(item) {
    selectedCell = item;
    document.getElementById('intel-panel').classList.remove('intel-hidden');
    
    const content = document.getElementById('intel-content');
    content.innerHTML = `
        <div class="intel-row"><span class="intel-lbl">Cell ID</span><span class="intel-val">${item.cell_id || '-'}</span></div>
        <div class="intel-row"><span class="intel-lbl">Risk Score</span><span class="intel-val">${(item.risk_score || 0).toFixed(3)}</span></div>
        <div class="intel-row"><span class="intel-lbl">Earthquakes</span><span class="intel-val">${item.n_earthquakes || 0}</span></div>
        <div class="intel-row"><span class="intel-lbl">Cyclones</span><span class="intel-val">${item.n_cyclones || 0}</span></div>
        <div class="intel-row"><span class="intel-lbl">Volcanoes</span><span class="intel-val">${item.n_volcanoes || 0}</span></div>
        <div class="intel-row"><span class="intel-lbl">Cluster</span><span class="intel-val">${item.kmeans_cluster !== undefined ? item.kmeans_cluster : '-'}</span></div>
        ${item.business ? `<div class="intel-row"><span class="intel-lbl">Business</span><span class="intel-val">${item.business}</span></div>` : ''}
        ${item.humanitarian ? `<div class="intel-row"><span class="intel-lbl">Humanitarian</span><span class="intel-val">${item.humanitarian}</span></div>` : ''}
    `;
}

function setupEventListeners() {
    // Sidebar toggle
    document.getElementById('toggle-sidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('sidebar-hidden');
    });
    
    document.getElementById('close-sidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('sidebar-hidden');
    });
    
    // Clear markers button
    document.getElementById('clear-markers').addEventListener('click', clearAllMarkers);
    
    // Close intel panel
    document.getElementById('close-intel').addEventListener('click', () => {
        document.getElementById('intel-panel').classList.add('intel-hidden');
    });
    
    // Min risk slider
    const minRiskSlider = document.getElementById('min-risk');
    const minRiskValue = document.getElementById('min-risk-value');
    minRiskSlider.addEventListener('input', () => {
        minRiskScore = parseFloat(minRiskSlider.value);
        minRiskValue.textContent = minRiskScore.toFixed(2);
        // Would need to re-render markers here
    });
    
    // Default markers toggle
    document.getElementById('show-default-markers').addEventListener('change', toggleDefaultMarkers);
    
    // Hazard toggles
    document.getElementById('show-earthquakes').addEventListener('change', () => {
        activeHazards.earthquakes = document.getElementById('show-earthquakes').checked;
    });
    document.getElementById('show-cyclones').addEventListener('change', () => {
        activeHazards.cyclones = document.getElementById('show-cyclones').checked;
    });
    document.getElementById('show-volcanoes').addEventListener('change', () => {
        activeHazards.volcanoes = document.getElementById('show-volcanoes').checked;
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Add default markers on init
window.addEventListener('load', () => {
    setTimeout(() => {
        if (showDefaultMarkers) {
            addDefaultMarkers();
        }
    }, 500);
});
