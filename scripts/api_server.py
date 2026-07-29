"""
FastAPI backend for GeoRisk Finder frontend.
Serves API endpoints matching the frontend's expected format.
"""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from pathlib import Path
from contextlib import asynccontextmanager

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data" / "processed"
FRONTEND_DIR = BASE_DIR / "frontend" / "dist"

cluster_df = None
interpretation_df = None
grid_features_df = None


async def load_data():
    global cluster_df, interpretation_df, grid_features_df
    if (DATA_DIR / "cluster_labels.csv").exists():
        cluster_df = pd.read_csv(DATA_DIR / "cluster_labels.csv")
        print(f"Loaded {len(cluster_df)} cluster labels")
    if (DATA_DIR / "interpretacion_clusters.csv").exists():
        interpretation_df = pd.read_csv(DATA_DIR / "interpretacion_clusters.csv")
        print(f"Loaded {len(interpretation_df)} cluster interpretations")
    if (DATA_DIR / "grid_features.csv").exists():
        grid_features_df = pd.read_csv(DATA_DIR / "grid_features.csv")
        print(f"Loaded {len(grid_features_df)} grid features")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await load_data()
    yield


app = FastAPI(title="GeoRisk Finder API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def normalize_ranking_data(df: pd.DataFrame) -> list:
    """Convert cluster data to frontend-expected format."""
    if df is None or df.empty:
        return []
    
    result = []
    for _, row in df.iterrows():
        # Calculate risk score from PC1 (higher = more risk)
        risk_score = float(row.get("PC1", 0))
        
        # Normalize risk score to 0-1 range
        if cluster_df is not None:
            max_pc1 = cluster_df["PC1"].max()
            min_pc1 = cluster_df["PC1"].min()
            if max_pc1 > min_pc1:
                risk_score = (risk_score - min_pc1) / (max_pc1 - min_pc1)
        
        # Get cluster info
        kmeans_cluster = int(row.get("kmeans_label", -1))
        cluster_info = {}
        if interpretation_df is not None and kmeans_cluster in interpretation_df["cluster"].values:
            info = interpretation_df[interpretation_df["cluster"] == kmeans_cluster].iloc[0]
            cluster_info = {
                "business": info.get("nombre_negocio", ""),
                "humanitarian": info.get("recomendacion", ""),
            }
        
        # Get grid features if available
        n_eq = 0
        n_cyc = 0
        n_vol = 0
        if grid_features_df is not None:
            cell_id = row.get("cell_id")
            grid_row = grid_features_df[grid_features_df["cell_id"] == cell_id]
            if not grid_row.empty:
                n_eq = int(grid_row.iloc[0].get("eq_count", 0))
                n_cyc = int(grid_row.iloc[0].get("cyclone_count", 0))
                n_vol = int(grid_row.iloc[0].get("volcano_count", 0))
        
        cell_id = row.get("cell_id")
        result.append({
            # Frontend H3HexagonLayer expects 'hexagon' field
            "hexagon": cell_id,
            "cell_id": cell_id,
            "lat": float(row.get("lat", 0)),
            "lon": float(row.get("lon", 0)),
            "risk_score": round(risk_score, 4),
            "n_earthquakes": n_eq,
            "n_cyclones": n_cyc,
            "n_volcanoes": n_vol,
            "kmeans_cluster": kmeans_cluster,
            "dbscan_label": int(row.get("dbscan_label", -1)),
            "cluster_color": f"hsl({kmeans_cluster * 72}, 70%, 50%)" if kmeans_cluster >= 0 else "#7f7f7f",
            "business": cluster_info.get("business", ""),
            "humanitarian": cluster_info.get("humanitarian", ""),
            # Position for ScatterplotLayer
            "position": [float(row.get("lon", 0)), float(row.get("lat", 0))],
        })
    
    return result


@app.get("/api/ranking")
async def get_ranking(limit: int = 20, cluster: int = None):
    """Return top risk cells with ranking data."""
    if cluster_df is None:
        return JSONResponse({"error": "Data not loaded"}, status_code=500)
    
    df = cluster_df.copy()
    
    if cluster is not None:
        df = df[df["kmeans_label"] == cluster]
    
    # Sort by PC1 (risk score) descending
    df = df.sort_values("PC1", ascending=False).head(limit)
    
    return normalize_ranking_data(df)


@app.get("/api/layers")
async def get_layers():
    """Return layer configuration for the frontend."""
    if cluster_df is None:
        return JSONResponse({"error": "Data not loaded"}, status_code=500)
    
    # Return ranking data as H3 layer
    ranking_data = normalize_ranking_data(cluster_df.sort_values("PC1", ascending=False).head(500))
    
    layers = [
        {
            "id": "h3",
            "type": "H3HexagonLayer",
            "props": {
                "extruded": False,
                "getElevation": "risk_score",
                "getFillColor": "[risk_score * 255, (1-risk_score) * 255, 50]",
                "pickable": True,
                "opacity": 0.6,
            },
            "data": ranking_data,
        },
        {
            "id": "hotspots",
            "type": "ScatterplotLayer",
            "props": {
                "getRadius": 50000,
                "getColor": "[255, 0, 0]",
                "pickable": True,
                "opacity": 0.8,
            },
            "data": ranking_data[:20],
        }
    ]
    
    return {
        "layers": layers,
        "view_state": {
            "latitude": 20,
            "longitude": 0,
            "zoom": 1.5,
            "bearing": 0,
            "pitch": 0,
        }
    }


@app.get("/api/search")
async def search(q: str = ""):
    """Search for places."""
    if not q:
        return []
    
    # Simple search in cluster data
    if cluster_df is None:
        return []
    
    # Search by cell_id prefix
    results = []
    q_lower = q.lower()
    
    # Match by cell_id
    matches = cluster_df[cluster_df["cell_id"].str.startswith(q_lower, na=False)].head(5)
    for _, row in matches.iterrows():
        results.append({
            "key": row["cell_id"],
            "label": f"Cell {row['cell_id'][:8]}",
            "lat": float(row["lat"]),
            "lon": float(row["lon"]),
        })
    
    return results


@app.get("/api/clusters")
async def get_clusters():
    """Return cluster interpretation metadata."""
    if interpretation_df is None:
        return JSONResponse({"error": "Data not loaded"}, status_code=500)
    return interpretation_df.to_dict(orient="records")


@app.get("/api/cell/{cell_id}")
async def get_cell(cell_id: str):
    """Get detailed info for a specific H3 cell."""
    if cluster_df is None or grid_features_df is None:
        return JSONResponse({"error": "Data not loaded"}, status_code=500)
    
    cluster_row = cluster_df[cluster_df["cell_id"] == cell_id]
    if cluster_row.empty:
        return JSONResponse({"error": "Cell not found"}, status_code=404)
    
    grid_row = grid_features_df[grid_features_df["cell_id"] == cell_id]
    
    result = cluster_row.iloc[0].to_dict()
    if not grid_row.empty:
        result["features"] = grid_row.iloc[0].to_dict()
    
    return result


@app.get("/api/stats")
async def get_stats():
    """Return global statistics."""
    if cluster_df is None:
        return JSONResponse({"error": "Data not loaded"}, status_code=500)
    
    return {
        "total_cells": int(len(cluster_df)),
        "kmeans_clusters": int(cluster_df["kmeans_label"].nunique()),
        "dbscan_clusters": int(cluster_df["dbscan_label"].nunique()),
        "noise_cells": int((cluster_df["dbscan_label"] == -1).sum()),
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve static frontend files
if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse({"error": "Not found"}, status_code=404)
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return JSONResponse({"error": "Frontend not built"}, status_code=404)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)