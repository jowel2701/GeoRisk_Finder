from functools import lru_cache
from pathlib import Path

import h3
import requests
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.data.adapters import DataAdapters

app = FastAPI(title="GeoRisk Finder")


@lru_cache(maxsize=1)
def _get_adapters() -> DataAdapters:
    return DataAdapters()


@app.on_event("startup")
def warmup_cache():
    import logging
    logging.info("Warming up DataAdapters cache...")
    adapters = _get_adapters()
    adapters.load_h3(force_preprocess=False)
    adapters.load_earthquakes()
    adapters.load_cyclones()
    adapters.load_volcanoes()
    logging.info("DataAdapters cache warmed up")


def _graticule_data():
    lines = []
    for lat in range(-90, 91, 30):
        pts = [[lon, lat] for lon in range(-180, 181, 5)]
        lines.append({"path": pts})
    for lon in range(-180, 181, 30):
        pts = [[lon, lat] for lat in range(-90, 91, 5)]
        lines.append({"path": pts})
    return lines


_PLATES_URL = "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json"


@lru_cache(maxsize=1)
def _fetch_plate_boundaries():
    r = requests.get(_PLATES_URL, timeout=10)
    r.raise_for_status()
    gj = r.json()
    paths = []
    for feat in gj["features"]:
        geom = feat["geometry"]
        if geom["type"] == "MultiLineString":
            for seg in geom["coordinates"]:
                paths.append({"path": [[c[0], c[1]] for c in seg]})
        elif geom["type"] == "LineString":
            paths.append({"path": [[c[0], c[1]] for c in geom["coordinates"]]})
    return paths


def _add_position(records):
    for r in records:
        r["position"] = [r["lon"], r["lat"]]
    return records


_layers_cache: dict | None = None


def serialize_active_layers():
    global _layers_cache
    if _layers_cache is not None:
        return _layers_cache

    adapters = _get_adapters()
    h3_df = adapters.load_h3()
    quake_df = adapters.load_earthquakes()
    cyclone_df = adapters.load_cyclones()
    volcano_df = adapters.load_volcanoes()
    heat_df = adapters.load_heatmap()

    layers = []
    layers.append({
        "id": "graticule", "type": "PathLayer",
        "data": _graticule_data(), "pickable": False,
        "props": {"getPath": "path", "getColor": [42, 53, 80, 50], "getWidth": 0.5, "widthMinPixels": 0.3, "opacity": 0.12},
    })
    h3_safe_cols = [
        "cell_id", "lat", "lon", "risk_score", "pc1",
        "kmeans_cluster", "dbscan_label",
        "elevation", "color", "cluster_color", "h3_index",
        "n_earthquakes", "n_cyclones", "n_volcanoes", "year",
    ]
    h3_records = h3_df[[c for c in h3_safe_cols if c in h3_df.columns]].to_dict(orient="records")
    layers.append({
        "id": "h3", "type": "H3HexagonLayer",
        "data": h3_records, "pickable": True,
        "props": {"getHexagon": "h3_index", "getFillColor": "color", "getElevation": 0, "elevationScale": 0, "extruded": False, "opacity": 0.7, "autoHighlight": False, "lineWidthMinPixels": 0.3, "getLineColor": [42, 53, 80, 100]},
    })
    if not quake_df.empty:
        layers.append({
            "id": "earthquakes", "type": "ScatterplotLayer",
            "data": _add_position(quake_df.to_dict(orient="records")), "pickable": True,
            "props": {"getPosition": "position", "getRadius": "radius", "getFillColor": "color", "radiusScale": 1, "radiusMinPixels": 1.5, "radiusMaxPixels": 15, "opacity": 0.6, "stroked": False},
        })
    if not cyclone_df.empty:
        layers.append({
            "id": "cyclones", "type": "PathLayer",
            "data": cyclone_df.to_dict(orient="records"), "pickable": True,
            "props": {"getPath": "path", "getColor": "color", "getWidth": "width", "widthScale": 1, "widthMinPixels": 1, "widthMaxPixels": 4, "opacity": 0.5, "capRounded": True},
        })
    if not volcano_df.empty:
        layers.append({
            "id": "volcanoes", "type": "ScatterplotLayer",
            "data": _add_position(volcano_df.to_dict(orient="records")), "pickable": True,
            "props": {"getPosition": "position", "getRadius": "radius", "getFillColor": "color", "getLineColor": [255, 255, 255, 100], "getLineWidth": 1.5, "radiusScale": 1, "radiusMinPixels": 4, "radiusMaxPixels": 12, "opacity": 0.8, "stroked": True},
        })
    if not heat_df.empty:
        layers.append({
            "id": "heatmap", "type": "HeatmapLayer",
            "data": _add_position(heat_df.to_dict(orient="records")), "pickable": False,
            "props": {"getPosition": "position", "getWeight": "risk_score", "aggregation": "MEAN", "radiusPixels": 25, "intensity": 1, "threshold": 0.05, "opacity": 0.35},
        })
    try:
        plates_data = _fetch_plate_boundaries()
    except Exception:
        plates_data = []
    if plates_data:
        layers.append({
            "id": "plates", "type": "PathLayer",
            "data": plates_data, "pickable": False,
            "props": {"getPath": "path", "getColor": [42, 53, 80, 120], "getWidth": 1, "widthMinPixels": 0.5, "opacity": 0.3},
        })
    _layers_cache = {"layers": layers, "view_state": {"latitude": 15, "longitude": 0, "zoom": 1.5, "pitch": 0, "bearing": 0}}
    return _layers_cache


@app.get("/api/layers")
def get_layers():
    return serialize_active_layers()


_ranking_cache: dict[int, list] = {}


@app.get("/api/ranking")
def get_ranking(limit: int = Query(10, ge=1, le=100)):
    if limit in _ranking_cache:
        return _ranking_cache[limit]
    adapters = _get_adapters()
    result = adapters.load_ranking(limit=limit)
    _ranking_cache[limit] = result
    return result


@app.get("/api/search")
def search(q: str = Query(..., min_length=1)):
    adapters = _get_adapters()
    result = adapters.search(q)
    if result is None:
        return {"found": False, "query": q}
    return {"found": True, "query": q, "result": result}


STATIC_DIR = Path(__file__).parent / "frontend" / "dist"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")
