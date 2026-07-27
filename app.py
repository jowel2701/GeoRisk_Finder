import streamlit as st
import json

from src.ui.styles import STREAMLIT_HIDE, TOP_BAR, STATUS_BAR
from src.data.adapters import DataAdapters

import georisk_globe

from georisk_globe.layer_panel import layer_panel as layer_panel_component
from georisk_globe.click_reader import click_reader

st.set_page_config(page_title="GeoRisk Finder", page_icon="\U0001f30d", layout="wide", initial_sidebar_state="collapsed")

st.markdown("""
<style>
#MainMenu,header,footer{visibility:hidden}
.main .block-container{padding:0rem!important;max-width:100%!important}
.stApp{background:#0b0f19!important}
body,html{margin:0;padding:0;overflow:hidden}
div[data-testid="stVerticalBlock"]>div{gap:0rem!important}
html,body,.stApp,.stMain,.stMainBlockContainer{height:100vh!important;overflow:hidden!important;margin:0!important;padding:0!important}
.st-key-layer_panel_container iframe{position:fixed!important;bottom:60px!important;right:24px!important;width:220px!important;height:280px!important;z-index:10!important;border:none!important}
div[data-testid="stTextInput"]{position:fixed!important;top:18px!important;left:50%!important;transform:translateX(-50%)!important;z-index:1001!important;width:240px!important;margin:0!important}
div[data-testid="stTextInput"]>div{margin:0!important;padding:0!important}
div[data-testid="stTextInput"] input{background:#0B0F19!important;border:1px solid #2A3550!important;border-radius:8px!important;color:#F8FAFC!important;font-family:'Inter',sans-serif!important;font-size:12px!important;padding:6px 12px 6px 32px!important;height:30px!important;box-shadow:none!important;background-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="%238892A4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>')!important;background-repeat:no-repeat!important;background-position:10px center!important;background-size:14px!important}
div[data-testid="stTextInput"] input:focus{border-color:#00D4FF!important;box-shadow:0 0 0 2px rgba(0,212,255,0.15)!important}
div[data-testid="stTextInput"] label{display:none!important}
.intel-panel{position:fixed;top:80px;right:20px;z-index:1000;width:260px;background:rgba(20,27,45,0.94);backdrop-filter:blur(16px);border:1px solid #2A3550;border-radius:12px;padding:16px;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:'Inter','IBM Plex Sans',sans-serif;max-height:80vh;overflow-y:auto}
.intel-panel .panel-title{font-size:10px;font-weight:600;color:#8892A4;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px}
.risk-score-section{text-align:center;padding:12px 0;margin-bottom:8px;border-bottom:1px solid rgba(42,53,80,0.3)}
.risk-score-value{font-size:42px;font-weight:700;font-family:'Space Grotesk',sans-serif;line-height:1;letter-spacing:-2px}
.risk-score-label{font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-top:4px}
.section-title{font-size:9px;font-weight:600;color:#5A6478;text-transform:uppercase;letter-spacing:1.5px;margin:10px 0 6px}
.factor-row{display:flex;align-items:center;gap:8px;padding:3px 0}
.factor-label{font-size:11px;color:#8892A4;width:100px;flex-shrink:0}
.factor-bar{flex:1;height:4px;background:rgba(42,53,80,0.5);border-radius:2px;overflow:hidden}
.factor-fill{height:100%;border-radius:2px}
.factor-fill.eq{background:#EF4444}
.factor-fill.plate{background:#00D4FF}
.factor-fill.vol{background:#F59E0B}
.factor-fill.climate{background:#5EEAD4}
.factor-pct{font-size:11px;color:#8892A4;width:30px;text-align:right;flex-shrink:0}
.timeline-row{display:flex;align-items:center;gap:8px;padding:2px 0}
.timeline-year{font-size:11px;color:#5A6478;width:30px;flex-shrink:0}
.timeline-bar{flex:1;height:4px;background:rgba(42,53,80,0.5);border-radius:2px;overflow:hidden}
.timeline-fill{height:100%;background:#2A3550;border-radius:2px}
.timeline-row.current .timeline-fill{background:#00D4FF}
.timeline-value{font-size:11px;color:#8892A4;width:24px;text-align:right;flex-shrink:0}
.timeline-row.current .timeline-value{color:#00D4FF;font-weight:600}
.event-item{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px;color:#8892A4;border-bottom:1px solid rgba(42,53,80,0.15)}
.event-item:last-child{border-bottom:none}
.event-icon{font-size:10px;width:16px;text-align:center}
.event-icon.eq{color:#EF4444}
.event-icon.cyc{color:#5EEAD4}
.event-icon.vol{color:#F59E0B}
.event-item span:nth-child(2){flex:1}
.event-time{font-size:10px;color:#5A6478}
.no-events{font-size:11px;color:#5A6478;font-style:italic;padding:4px 0}
.confidence-section{display:flex;justify-content:space-between;align-items:center;padding:8px 0 0;margin-top:4px;border-top:1px solid rgba(42,53,80,0.3)}
.confidence-label{font-size:10px;color:#5A6478;text-transform:uppercase;letter-spacing:1px}
.confidence-value{font-size:13px;font-weight:700;font-family:'Space Grotesk',sans-serif}
.block-container{padding:0!important;max-width:none!important}
</style>""", unsafe_allow_html=True)

GLOBE_IFRAME = """
<iframe
    id="georisk-globe-iframe"
    src="/component/georisk_globe.georisk_globe/index.html"
    style="position:fixed;top:0;left:0;width:100vw;height:100vh;border:none;z-index:0;"
></iframe>
"""
st.markdown(GLOBE_IFRAME, unsafe_allow_html=True)

st.markdown(STREAMLIT_HIDE + TOP_BAR + STATUS_BAR, unsafe_allow_html=True)

# ---- SESSION STATE ----
if "data" not in st.session_state:
    st.session_state.data = DataAdapters(n_cells=5000)
if "vs" not in st.session_state:
    st.session_state.vs = {"latitude": 15, "longitude": 0, "zoom": 1.5, "pitch": 0, "bearing": 0}
if "selected" not in st.session_state:
    st.session_state.selected = None
if "lyr" not in st.session_state:
    st.session_state.lyr = {"h3": True, "earthquakes": True, "cyclones": True, "volcanoes": True, "heatmap": False, "plates": True}
if "city" not in st.session_state:
    st.session_state.city = ""

# ---- DATA ----
adapters = st.session_state.data
h3_df = adapters.load_h3()
quake_df = adapters.load_earthquakes()
cyclone_df = adapters.load_cyclones()
volcano_df = adapters.load_volcanoes()
heat_df = adapters.load_heatmap()

# ---- SEARCH ----
city = st.text_input("Search", key="city", placeholder="Search city...", label_visibility="collapsed")
if city and city != st.session_state.get("_last_city", ""):
    result = adapters.search(city)
    if result:
        st.session_state.vs = {"latitude": result["lat"], "longitude": result["lon"], "zoom": result.get("zoom", 5), "pitch": 30, "bearing": 0, "transitionDuration": 2000}
        st.rerun()
    st.session_state["_last_city"] = city

# ---- LAYER PANEL ----
with st.container(key="layer_panel_container"):
    layer_result = layer_panel_component(layer_states=st.session_state.lyr, key="layer_panel")
    if layer_result and layer_result in st.session_state.lyr:
        st.session_state.lyr[layer_result] = not st.session_state.lyr[layer_result]

# ---- LAYER SERIALIZATION ----
def _graticule_data():
    lines = []
    for lat in range(-90, 91, 30):
        pts = [[lon, lat] for lon in range(-180, 181, 5)]
        lines.append({"path": pts})
    for lon in range(-180, 181, 30):
        pts = [[lon, lat] for lat in range(-90, 91, 5)]
        lines.append({"path": pts})
    return lines

def _add_position(records):
    for r in records:
        r["position"] = [r["lon"], r["lat"]]
    return records

def serialize_active_layers(lyr, h3_df, quake_df, cyclone_df, volcano_df, heat_df):
    layers = []
    layers.append({
        "id": "graticule", "type": "PathLayer",
        "data": _graticule_data(), "pickable": False,
        "props": {"getPath": "path", "getColor": [42, 53, 80, 50], "getWidth": 0.5, "widthMinPixels": 0.3, "opacity": 0.12},
    })
    if lyr.get("h3", True):
        layers.append({
            "id": "h3", "type": "H3HexagonLayer",
            "data": h3_df.to_dict(orient="records"), "pickable": True,
            "props": {"getHexagon": "h3_index", "getFillColor": "color", "getElevation": "elevation", "elevationScale": 20, "extruded": False, "opacity": 0.6, "autoHighlight": True, "highlightColor": [0, 212, 255, 80]},
        })
    if lyr.get("earthquakes", True):
        layers.append({
            "id": "earthquakes", "type": "ScatterplotLayer",
            "data": _add_position(quake_df.to_dict(orient="records")), "pickable": True,
            "props": {"getPosition": "position", "getRadius": "radius", "getFillColor": "color", "radiusScale": 1, "radiusMinPixels": 1.5, "radiusMaxPixels": 30, "opacity": 0.7, "stroked": False},
        })
    if lyr.get("cyclones", True):
        layers.append({
            "id": "cyclones", "type": "PathLayer",
            "data": cyclone_df.to_dict(orient="records"), "pickable": True,
            "props": {"getPath": "path", "getColor": "color", "getWidth": "width", "widthScale": 1, "widthMinPixels": 1, "widthMaxPixels": 6, "opacity": 0.6, "capRounded": True},
        })
    if lyr.get("volcanoes", True):
        layers.append({
            "id": "volcanoes", "type": "ScatterplotLayer",
            "data": _add_position(volcano_df.to_dict(orient="records")), "pickable": True,
            "props": {"getPosition": "position", "getRadius": "radius", "getFillColor": "color", "getLineColor": [255, 255, 255, 100], "getLineWidth": 1.5, "radiusScale": 1, "radiusMinPixels": 4, "radiusMaxPixels": 20, "opacity": 0.8, "stroked": True},
        })
    if lyr.get("heatmap", False):
        layers.append({
            "id": "heatmap", "type": "HeatmapLayer",
            "data": _add_position(heat_df.to_dict(orient="records")), "pickable": False,
            "props": {"getPosition": "position", "getWeight": "risk_score", "aggregation": "MEAN", "radiusPixels": 30, "intensity": 1, "threshold": 0.05, "opacity": 0.4},
        })
    if lyr.get("plates", True):
        plates_data = [
            {"source": [-80, -20], "target": [-60, 10]},
            {"source": [-60, 10], "target": [-100, 30]},
            {"source": [-100, 30], "target": [-80, -20]},
        ]
        layers.append({
            "id": "plates", "type": "LineLayer",
            "data": plates_data, "pickable": False,
            "props": {"getSourcePosition": "source", "getTargetPosition": "target", "getColor": [42, 53, 80, 120], "getWidth": 1, "widthMinPixels": 0.5, "opacity": 0.3},
        })
    return layers

active_layers = serialize_active_layers(st.session_state.lyr, h3_df, quake_df, cyclone_df, volcano_df, heat_df)

# ---- SEND DATA TO GLOBE VIA postMessage ----
def push_to_globe(layers_json, view_state):
    print("[Python] push_to_globe called")
    n_layers = len(layers_json)
    print("[Python] layers:", n_layers)
    print("[Python] view_state:", view_state)
    vs_json = json.dumps(view_state)
    lj_json = json.dumps(layers_json)
    print("[Python] payload bytes:", len(lj_json))
    print("[Python] vs_json length:", len(vs_json))
    script = f"""
    <script>
    console.log("[APP SCRIPT EXECUTED]");
    (function() {{
        const iframe = document.getElementById('georisk-globe-iframe');
        console.log("[App] iframe element:", iframe);
        if (!iframe) {{ console.warn("[App] iframe not found"); return; }}
        const send = () => {{
            console.log("[App] Sending layers ({n_layers} items)...");
            console.log("[App] Sending viewstate", {vs_json});
            if (iframe.contentWindow) {{
                console.log("[App] iframe.contentWindow exists");
                iframe.contentWindow.postMessage(
                    {{type:'georisk_layers', layers: {lj_json}}}, '*'
                );
                iframe.contentWindow.postMessage(
                    {{type:'georisk_viewstate', view_state: {vs_json}}}, '*'
                );
                console.log("[App] postMessage sent");
            }} else {{
                console.error("[App] iframe.contentWindow is null!");
            }}
        }};
        if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {{
            console.log("[App] iframe ready, sending immediately");
            send();
        }} else {{
            console.log("[App] iframe not ready, waiting for load event");
            iframe.addEventListener('load', send);
        }}
    }})();
    </script>
    """
    print("[Python] script length:", len(script))
    print("[Python] script[:300]:", script[:300])
    print("[Python] injecting postMessage script")
    st.markdown(script, unsafe_allow_html=True)

push_to_globe(active_layers, st.session_state.vs)

# ---- READ CLICKS ----
clicked = click_reader(key="click_reader")
if clicked and isinstance(clicked, dict):
    st.session_state.selected = clicked
    st.rerun()

# ---- TOP BAR ----
st.markdown(
    '<div class="top-bar"><div class="logo">GeoRisk <span>Finder</span></div>'
    '<div class="divider"></div>'
    '<div class="btn-group">'
    '<button class="btn-icon" title="Layers">\u2b22</button>'
    '<button class="btn-icon" onclick="window.location.reload()" title="Reset View">\u27f2</button>'
    '</div></div>',
    unsafe_allow_html=True,
)

# ---- INTEL PANEL ----
sel = st.session_state.selected
if sel is None:
    sel = {"risk_score": 0.5, "n_earthquakes": 1, "n_cyclones": 1, "n_volcanoes": 0, "pc1": 0.0}
risk = sel.get("risk_score", 0.5)
if isinstance(risk, (int, float)):
    risk_pct = int(risk * 100)
    risk_label = "HIGH" if risk > 0.6 else ("MEDIUM" if risk > 0.3 else "LOW")
    risk_color = "#EF4444" if risk > 0.6 else ("#F59E0B" if risk > 0.3 else "#10B981")
else:
    risk_pct, risk_label, risk_color = 50, "MEDIUM", "#F59E0B"
n_eq = sel.get("n_earthquakes", 0)
n_cyc = sel.get("n_cyclones", 0)
n_vol = sel.get("n_volcanoes", 0)
pc1 = abs(sel.get("pc1", 0))
eq_factor = min(int(max(n_eq, 0) * 4.5 + 10), 100)
plate_factor = min(int(pc1 * 12 + 25), 100)
volcano_factor = min(int(max(n_vol, 0) * 20 + 5), 100)
climate_factor = max(5, min(100 - eq_factor, 90))
t2022 = max(8, int(risk_pct * 0.45))
t2024 = max(12, int(risk_pct * 0.70))
t2026 = risk_pct
events_rows = ""
if n_eq > 0:
    mag = 4 + (n_eq % 4)
    hours = max(1, n_eq % 24)
    events_rows += '<div class="event-item"><span class="event-icon eq">\u25cf</span><span>M{} Earthquake</span><span class="event-time">{}h ago</span></div>'.format(mag, hours)
if n_cyc > 0:
    cat = min(n_cyc, 5)
    days = max(1, n_cyc * 2 % 30)
    events_rows += '<div class="event-item"><span class="event-icon cyc">\u27a4</span><span>Category {} Cyclone</span><span class="event-time">{}d ago</span></div>'.format(cat, days)
if n_vol > 0:
    events_rows += '<div class="event-item"><span class="event-icon vol">\u25b2</span><span>Volcanic activity</span><span class="event-time">1w ago</span></div>'
if not events_rows:
    events_rows = '<div class="no-events">No recent events</div>'
confidence = "High" if risk_pct > 60 else ("Medium" if risk_pct > 30 else "Low")
confidence_color = "#10B981" if confidence == "High" else ("#F59E0B" if confidence == "Medium" else "#8892A4")
intel_html = """<div class="intel-panel">
<div class="panel-title">GeoRisk Intelligence</div>
<div class="risk-score-section"><div class="risk-score-value" style="color:C1">SCORE</div><div class="risk-score-label" style="color:C1">LABEL</div></div>
<div class="section-title">Risk Factors</div>
<div class="factor-row"><span class="factor-label">Earthquakes</span><div class="factor-bar"><div class="factor-fill eq" style="width:V1%"></div></div><span class="factor-pct">V1%</span></div>
<div class="factor-row"><span class="factor-label">Plate proximity</span><div class="factor-bar"><div class="factor-fill plate" style="width:V2%"></div></div><span class="factor-pct">V2%</span></div>
<div class="factor-row"><span class="factor-label">Volcano activity</span><div class="factor-bar"><div class="factor-fill vol" style="width:V3%"></div></div><span class="factor-pct">V3%</span></div>
<div class="factor-row"><span class="factor-label">Climate exposure</span><div class="factor-bar"><div class="factor-fill climate" style="width:V4%"></div></div><span class="factor-pct">V4%</span></div>
<div class="section-title">Risk Timeline</div>
<div class="timeline-row"><span class="timeline-year">2022</span><div class="timeline-bar"><div class="timeline-fill" style="width:V5%"></div></div><span class="timeline-value">V5</span></div>
<div class="timeline-row"><span class="timeline-year">2024</span><div class="timeline-bar"><div class="timeline-fill" style="width:V6%"></div></div><span class="timeline-value">V6</span></div>
<div class="timeline-row current"><span class="timeline-year">2026</span><div class="timeline-bar"><div class="timeline-fill current" style="width:V7%"></div></div><span class="timeline-value">V7</span></div>
<div class="section-title">Event History</div>EVENTS
<div class="confidence-section"><span class="confidence-label">Confidence</span><span class="confidence-value" style="color:C8">CONF</span></div>
</div>"""
intel_html = intel_html.replace("C1", risk_color).replace("SCORE", str(risk_pct)).replace("LABEL", risk_label)
for i, v in enumerate([eq_factor, plate_factor, volcano_factor, climate_factor, t2022, t2024, t2026], 1):
    intel_html = intel_html.replace(f"V{i}", str(v))
intel_html = intel_html.replace("EVENTS", events_rows).replace("CONF", confidence).replace("C8", confidence_color)
st.markdown(intel_html, unsafe_allow_html=True)

# ---- STATUS BAR ----
total_cells = len(h3_df)
total_quakes = len(quake_df)
mean_risk = h3_df["risk_score"].mean()
st.markdown(
    '<div class="status-bar"><div class="status-left">'
    '<span>\U0001f30d GeoRisk Finder</span><span class="dot green"></span>'
    f'<span>{total_cells:,} cells</span><span>\u2022</span><span>{total_quakes:,} events</span>'
    '</div><div class="status-right">'
    f'<span>Mean Risk: {mean_risk:.3f}</span><span>\u2022</span><span>v1.0.0</span>'
    '</div></div>',
    unsafe_allow_html=True,
)
