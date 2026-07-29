from pathlib import Path
import warnings

import joblib
import numpy as np
import pandas as pd

from src.clustering import (
    compute_elbow,
    find_knee_point,
    fit_dbscan,
    fit_kmeans,
    suggest_eps,
)

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "processed"
MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
H3_CACHE_PATH = DATA_DIR / "h3_cache.pkl"

_REGIONS = [
    ("Japan", 130, 146, 30, 46),
    ("Philippines", 116, 128, 4, 21),
    ("Indonesia", 95, 142, -11, 6),
    ("Chile", -76, -66, -56, -18),
    ("Peru", -82, -68, -19, 0),
    ("Mexico", -118, -86, 14, 33),
    ("Central America", -93, -77, 7, 19),
    ("California", -125, -114, 32, 42),
    ("Alaska", -170, -130, 51, 72),
    ("Pacific Ring", 120, -70, -60, 60),
    ("Caribbean", -90, -60, 8, 28),
    ("Mediterranean", -10, 40, 30, 48),
    ("Middle East", 35, 60, 12, 42),
    ("Himalayas", 72, 98, 26, 38),
    ("New Zealand", 166, 179, -48, -34),
    ("Iceland", -25, -15, 63, 67),
    ("East Africa Rift", 29, 42, -20, 5),
    ("India", 68, 98, 6, 36),
    ("China", 73, 136, 18, 54),
    ("Russia", 30, 180, 45, 72),
    ("Europe", -10, 40, 36, 60),
    ("South America", -82, -34, -56, 12),
    ("North America", -130, -60, 24, 50),
    ("Australia", 112, 155, -44, -10),
    ("Africa", -20, 52, -36, 38),
]


def _region_name(lat: float, lon: float) -> str:
    for name, w, e, s, n in _REGIONS:
        if w <= e:
            if w <= lon <= e and s <= lat <= n:
                return name
        else:
            if lon >= w or lon <= e:
                if s <= lat <= n:
                    return name
    return "Unknown"


def _classify_storm_category(wind_speed: float) -> str:
    if pd.isna(wind_speed) or wind_speed < 34:
        return "TD"
    if wind_speed < 64:
        return "TS"
    if wind_speed < 83:
        return "C1"
    if wind_speed < 96:
        return "C2"
    if wind_speed < 113:
        return "C3"
    if wind_speed < 137:
        return "C4"
    return "C5"


def _risk_color(risk: float) -> list:
    if risk < 0.25:
        return [16, 185, 129, 180]
    if risk < 0.5:
        return [245, 158, 11, 180]
    if risk < 0.75:
        return [249, 115, 22, 200]
    return [239, 68, 68, 220]


_CLUSTER_PALETTE = [
    [59, 130, 246, 180],
    [239, 68, 68, 180],
    [16, 185, 129, 180],
    [245, 158, 11, 180],
    [139, 92, 246, 180],
    [236, 72, 153, 180],
    [34, 211, 238, 180],
    [251, 146, 60, 180],
    [132, 204, 22, 180],
    [168, 85, 247, 180],
]


def _cluster_color(cluster_id: int) -> list:
    return _CLUSTER_PALETTE[cluster_id % len(_CLUSTER_PALETTE)]


def _magnitude_color(mag: float) -> list:
    if mag < 4:
        return [16, 185, 129, 180]
    if mag < 5:
        return [245, 158, 11, 180]
    if mag < 6:
        return [249, 115, 22, 200]
    if mag < 7:
        return [239, 68, 68, 220]
    return [239, 68, 68, 255]


def _cyclone_color(cat: str) -> list:
    colors = {
        "TD": [16, 185, 129, 160],
        "TS": [94, 234, 212, 160],
        "C1": [245, 158, 11, 180],
        "C2": [249, 115, 22, 180],
        "C3": [239, 68, 68, 200],
        "C4": [220, 38, 38, 220],
        "C5": [180, 20, 20, 240],
    }
    return colors.get(cat, [100, 100, 100, 160])


def _cyclone_width(cat: str) -> int:
    widths = {"TD": 1, "TS": 1.5, "C1": 2, "C2": 2.5, "C3": 3, "C4": 4, "C5": 5}
    return widths.get(cat, 1)


class DataAdapters:
    def __init__(self):
        self._h3_cache = None
        self._quake_cache = None
        self._cyclone_cache = None
        self._volcano_cache = None
        self._heatmap_cache = None
        self._pipeline_cache = None

    def _load_pipeline(self):
        if self._pipeline_cache is not None:
            return self._pipeline_cache
        path = MODELS_DIR / "pipeline_riesgo.joblib"
        if path.exists():
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                self._pipeline_cache = joblib.load(path)
        else:
            self._pipeline_cache = None
        return self._pipeline_cache

    def _compute_risk_and_pc1(self, grid_df: pd.DataFrame) -> pd.DataFrame:
        pipeline = self._load_pipeline()
        df = grid_df.copy()
        if "categoria_tormenta" not in df.columns:
            df["categoria_tormenta"] = df["wind_mean"].apply(_classify_storm_category)

        exclude = {"lat", "lon", "cell_id"}
        numeric_cols = [
            c
            for c in df.select_dtypes(include=[np.number]).columns
            if c not in exclude
        ]
        feature_cols = numeric_cols + ["categoria_tormenta"]
        X = df[feature_cols].copy()
        for c in X.select_dtypes(include=[np.number]).columns:
            X[c] = X[c].fillna(X[c].median())

        if pipeline is not None:
            try:
                components = pipeline.transform(X)
                pc1 = components[:, 0]
            except Exception:
                pc1 = np.zeros(len(df))
        else:
            pc1 = np.zeros(len(df))

        pc1_min, pc1_max = pc1.min(), pc1.max()
        if pc1_max > pc1_min:
            risk_score = (pc1 - pc1_min) / (pc1_max - pc1_min)
        else:
            risk_score = np.zeros(len(df))
        risk_score = risk_score.clip(0, 1)

        df["risk_score"] = risk_score
        df["pc1"] = pc1
        return df

    def _compute_clusters(self, grid_df: pd.DataFrame) -> pd.DataFrame:
        df = grid_df.copy()
        if "categoria_tormenta" not in df.columns:
            df["categoria_tormenta"] = df["wind_mean"].apply(_classify_storm_category)

        exclude = {"lat", "lon", "cell_id"}
        numeric_cols = [
            c for c in df.select_dtypes(include=[np.number]).columns if c not in exclude
        ]
        cat_dummies = pd.get_dummies(df["categoria_tormenta"], prefix="cat")
        X_num = df[numeric_cols].copy()
        for c in X_num.select_dtypes(include=[np.number]).columns:
            X_num[c] = X_num[c].fillna(X_num[c].median())
        X = pd.concat([X_num, cat_dummies], axis=1).values

        n_cells = len(df)
        k = 5
        if n_cells > 20:
            try:
                elbow_df = compute_elbow(X, k_range=range(2, min(11, n_cells)))
                knee_idx = find_knee_point(elbow_df["inertia"].values)
                k = int(elbow_df.iloc[knee_idx]["k"])
            except Exception:
                k = max(2, min(5, n_cells // 50))

        km_labels, _ = fit_kmeans(X, n_clusters=k)
        df["kmeans_cluster"] = km_labels

        try:
            eps = suggest_eps(X, k=5)
            db_labels, _ = fit_dbscan(X, eps=eps)
        except Exception:
            db_labels = np.zeros(len(df), dtype=int)
        df["dbscan_label"] = db_labels

        return df

    def load_h3(self, force_preprocess: bool = True) -> pd.DataFrame:
        if self._h3_cache is not None:
            return self._h3_cache

        if not force_preprocess and H3_CACHE_PATH.exists():
            try:
                self._h3_cache = pd.read_pickle(H3_CACHE_PATH)
                return self._h3_cache
            except Exception:
                pass

        path = DATA_DIR / "grid_features.csv"
        if path.exists():
            df = pd.read_csv(path)
        else:
            return pd.DataFrame()

        df = self._compute_risk_and_pc1(df)
        df = self._compute_clusters(df)
        df["elevation"] = 0
        df["color"] = df["risk_score"].apply(_risk_color)
        df["cluster_color"] = df["kmeans_cluster"].apply(_cluster_color)
        df["h3_index"] = df["cell_id"]
        df["n_earthquakes"] = df["eq_count"].fillna(0).astype(int)
        df["n_cyclones"] = df["cyclone_count"].fillna(0).astype(int)
        df["n_volcanoes"] = df["volcano_count"].fillna(0).astype(int)
        df["year"] = 2026

        try:
            pd.to_pickle(df, H3_CACHE_PATH)
        except Exception:
            pass

        self._h3_cache = df
        return self._h3_cache

    def load_earthquakes(self, n: int = 20000) -> pd.DataFrame:
        if self._quake_cache is not None:
            return self._quake_cache

        path = DATA_DIR / "usgs_earthquakes_clean.csv"
        if path.exists():
            df = pd.read_csv(path)
        else:
            return pd.DataFrame()

        df = df.drop_duplicates(subset=["event_id"]).head(n)
        df["radius"] = df["magnitude"].fillna(3).clip(3, 30) * 1.5
        df["color"] = df["magnitude"].fillna(3).apply(_magnitude_color)
        df["year"] = pd.to_datetime(df["timestamp"], errors="coerce").dt.year.fillna(2000).astype(int)
        df = df.rename(columns={"magnitude": "magnitude", "depth_km": "depth"})
        df = df[["lat", "lon", "magnitude", "depth", "year", "radius", "color"]].dropna(subset=["lat", "lon"])

        self._quake_cache = df
        return self._quake_cache

    def load_cyclones(self) -> pd.DataFrame:
        if self._cyclone_cache is not None:
            return self._cyclone_cache

        path = DATA_DIR / "ciclones_clean.csv"
        if path.exists():
            df = pd.read_csv(path)
        else:
            return pd.DataFrame()

        rows = []
        for event_id, group in df.groupby("event_id"):
            group = group.sort_values("timestamp")
            pts = group[["lon", "lat"]].dropna().values.tolist()
            if len(pts) < 2:
                continue
            wind = group["wind"].dropna()
            wind_mean = wind.mean() if not wind.empty else 0
            cat = _classify_storm_category(wind_mean)
            ts = pd.to_datetime(group["timestamp"].iloc[0], errors="coerce")
            rows.append({
                "path": pts,
                "color": _cyclone_color(cat),
                "width": _cyclone_width(cat),
                "category": cat,
                "year": ts.year if pd.notna(ts) else 2000,
            })

        self._cyclone_cache = pd.DataFrame(rows)
        return self._cyclone_cache

    def load_volcanoes(self) -> pd.DataFrame:
        if self._volcano_cache is not None:
            return self._volcano_cache

        path = DATA_DIR / "volcanes_clean.csv"
        if path.exists():
            df = pd.read_csv(path)
        else:
            return pd.DataFrame()

        df = df.drop_duplicates(subset=["place", "lat", "lon"]).copy()
        df["radius"] = 6
        df["color"] = df.apply(lambda _: [239, 68, 68, 200], axis=1)
        df["year"] = 2026
        df["elevation"] = df["elevation"].fillna(0).astype(int)
        df["active"] = True
        df = df[["lat", "lon", "elevation", "active", "year", "radius", "color"]].dropna(subset=["lat", "lon"])

        self._volcano_cache = df
        return self._volcano_cache

    def load_heatmap(self) -> pd.DataFrame:
        if self._heatmap_cache is not None:
            return self._heatmap_cache
        h3_data = self.load_h3()
        if h3_data.empty:
            self._heatmap_cache = pd.DataFrame()
            return self._heatmap_cache
        self._heatmap_cache = h3_data[["lat", "lon", "risk_score"]].copy()
        return self._heatmap_cache

    def search(self, query: str) -> dict | None:
        cities = {
            "madrid": {"lat": 40.4168, "lon": -3.7038, "zoom": 6},
            "tokio": {"lat": 35.6762, "lon": 139.6503, "zoom": 5},
            "japon": {"lat": 36.2048, "lon": 138.2529, "zoom": 4},
            "chile": {"lat": -33.4489, "lon": -70.6693, "zoom": 4},
            "indonesia": {"lat": -0.7893, "lon": 113.9213, "zoom": 4},
            "california": {"lat": 36.7783, "lon": -119.4179, "zoom": 5},
            "valencia": {"lat": 39.4699, "lon": -0.3763, "zoom": 7},
            "venezuela": {"lat": 6.4238, "lon": -66.9036, "zoom": 5},
            "espana": {"lat": 40.4637, "lon": -3.7492, "zoom": 4},
            "canarias": {"lat": 28.2916, "lon": -16.6291, "zoom": 6},
            "manila": {"lat": 14.5995, "lon": 120.9842, "zoom": 7},
            "yakarta": {"lat": -6.2088, "lon": 106.8456, "zoom": 7},
            "katmandu": {"lat": 27.7172, "lon": 85.3240, "zoom": 7},
            "estambul": {"lat": 41.0082, "lon": 28.9784, "zoom": 7},
            "napoles": {"lat": 40.8518, "lon": 14.2681, "zoom": 8},
            "san francisco": {"lat": 37.7749, "lon": -122.4194, "zoom": 7},
            "santiago": {"lat": -33.4489, "lon": -70.6693, "zoom": 7},
            "caracas": {"lat": 10.4806, "lon": -66.9036, "zoom": 7},
            "lima": {"lat": -12.0464, "lon": -77.0428, "zoom": 7},
            "bogota": {"lat": 4.7110, "lon": -74.0721, "zoom": 7},
            "port-au-prince": {"lat": 18.5944, "lon": -72.3074, "zoom": 7},
            "mexico": {"lat": 19.4326, "lon": -99.1332, "zoom": 6},
            "colombia": {"lat": 4.5709, "lon": -74.2073, "zoom": 6},
            "peru": {"lat": -12.0464, "lon": -77.0428, "zoom": 6},
            "filipinas": {"lat": 12.8797, "lon": 121.774, "zoom": 7},
            "nepal": {"lat": 27.7172, "lon": 85.324, "zoom": 7},
        }
        q = query.lower().strip()
        if q in cities:
            return self._snap_to_h3(cities[q])
        for name, coords in cities.items():
            if q in name:
                return self._snap_to_h3(coords)
        return None

    def _snap_to_h3(self, coords: dict) -> dict:
        """Snaps a city coordinate to the nearest H3 cell from grid_features.csv."""
        try:
            h3_data = self.load_h3()
            if h3_data.empty:
                return coords
            lat, lon = coords["lat"], coords["lon"]
            h3_data["_dist"] = (h3_data["lat"] - lat) ** 2 + (h3_data["lon"] - lon) ** 2
            nearest = h3_data.loc[h3_data["_dist"].idxmin()]
            return {"lat": float(nearest["lat"]), "lon": float(nearest["lon"]), "zoom": coords.get("zoom", 6)}
        except Exception:
            return coords

    def load_ranking(self, limit: int = 10) -> list:
        h3_data = self.load_h3()
        if h3_data.empty:
            return []
        top = h3_data.nlargest(limit, "risk_score")
        records = top[[
            "cell_id", "lat", "lon", "risk_score", "pc1",
            "n_earthquakes", "n_cyclones", "n_volcanoes",
            "eq_count", "cyclone_count", "volcano_count",
        ]].to_dict(orient="records")
        for r in records:
            r["region"] = _region_name(r["lat"], r["lon"])
        return records
