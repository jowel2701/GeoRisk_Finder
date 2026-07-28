import os
import time
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from src.clustering import (
    cluster_summary,
    compute_elbow,
    compute_silhouette_by_k,
    find_knee_point,
    fit_dbscan,
    fit_kmeans,
    k_distance_values,
    silhouette_excluding_noise,
    suggest_eps,
)
from src.config.mlflow_config import (
    CLUSTER_FEATURE_SPACE,
    CLUSTER_RUN_NAME_TEMPLATE,
    DBSCAN_MIN_SAMPLES,
    DEFAULT_TAGS_CLUSTERING,
    ENABLE_TRACKING,
    FIGURES_DIR,
    KMEANS_DEFAULT_K,
    KMEANS_K_RANGE,
    MODELS_DIR,
    RANDOM_STATE,
)
from src.preprocessing import _prepare_features, _build_pipeline, load_pipeline
from src.utils.mlflow_utils import (
    log_dataset_info,
    log_figures,
    log_model,
    safe_end_run,
    setup_mlflow,
    start_pipeline_run,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"

PCA_PIPELINE_PATH = Path(__file__).resolve().parent.parent / "models" / "pipeline_riesgo.joblib"


def _log_cluster_params(labels_kmeans, labels_dbscan, k, eps, n_total, runtime, n_noise, silhouette_kmeans, silhouette_dbscan, silhouette_dbscan_clean, inertia):
    import mlflow
    mlflow.log_params({
        "kmeans_k": k,
        "kmeans_inertia": round(inertia, 4),
        "dbscan_eps": round(eps, 4),
        "dbscan_min_samples": DBSCAN_MIN_SAMPLES,
        "n_cells": n_total,
        "feature_space": CLUSTER_FEATURE_SPACE,
        "n_kmeans_clusters": int(labels_kmeans.max() + 1),
        "n_dbscan_clusters": len(np.unique(labels_dbscan)) - (1 if -1 in labels_dbscan else 0),
        "n_dbscan_noise": int(n_noise),
    })
    mlflow.log_metrics({
        "silhouette_kmeans": round(float(silhouette_kmeans), 4) if silhouette_kmeans is not None else -1,
        "silhouette_dbscan": round(float(silhouette_dbscan), 4) if silhouette_dbscan is not None else -1,
        "silhouette_dbscan_clean": round(float(silhouette_dbscan_clean), 4) if silhouette_dbscan_clean is not None else -1,
        "runtime_seconds": round(runtime, 2),
    })


def _build_run_name(source, k, eps):
    return CLUSTER_RUN_NAME_TEMPLATE.format(source=source.upper(), k=k, eps=eps)


def train_clustering_pipeline(
    df_raw: pd.DataFrame,
    pca_pipeline=None,
    k_range: tuple = KMEANS_K_RANGE,
    dbscan_min_samples: int = DBSCAN_MIN_SAMPLES,
    feature_space: str = CLUSTER_FEATURE_SPACE,
    save_models: bool = True,
    nested: bool = False,
) -> dict:
    source = "real" if df_raw.shape[0] > 5000 else "test"
    t0 = time.time()

    X_prep, feature_cols = _prepare_features(df_raw)

    if pca_pipeline is None:
        if PCA_PIPELINE_PATH.exists():
            pca_pipeline = load_pipeline(str(PCA_PIPELINE_PATH))
        else:
            pca_pipeline = _build_pipeline(0.85, RANDOM_STATE)
            pca_pipeline.fit(X_prep)

    X_scaled = pca_pipeline.named_steps["scaler"].transform(
        pca_pipeline.named_steps["onehot"].transform(
            pca_pipeline.named_steps["log_skew"].transform(X_prep)
        )
    )
    X_pca = pca_pipeline.transform(X_prep)

    if feature_space == "pca":
        X_cluster = X_pca
    else:
        X_cluster = X_scaled

    n_total = X_cluster.shape[0]
    k_min, k_max = k_range
    effective_k_max = min(k_max, n_total - 1)
    if effective_k_max <= k_min:
        effective_k_max = k_min + 1

    import mlflow

    elbow_df = compute_elbow(X_cluster, k_range=range(k_min, effective_k_max + 1), random_state=RANDOM_STATE)
    knee_idx = find_knee_point(elbow_df["inertia"].values)
    k = int(elbow_df.iloc[knee_idx]["k"])

    silhouette_df = compute_silhouette_by_k(X_cluster, k_range=range(k_min, effective_k_max + 1), random_state=RANDOM_STATE)

    km_labels, km_model = fit_kmeans(X_cluster, n_clusters=k, random_state=RANDOM_STATE)

    eps = suggest_eps(X_cluster, k=dbscan_min_samples)
    db_labels, db_model = fit_dbscan(X_cluster, eps=eps, min_samples=dbscan_min_samples)

    summary = cluster_summary(db_labels)
    n_noise = summary["n_noise"]
    n_db_clusters = summary["n_clusters"]

    sk_kmeans = float(silhouette_df[silhouette_df["k"] == k]["silhouette"].values[0]) if k in silhouette_df["k"].values else None
    sk_dbscan = silhouette_excluding_noise(X_cluster, db_labels) if len(np.unique(db_labels)) > 1 else None
    sk_dbscan_full = float(silhouette_score_safe(X_cluster, db_labels))

    runtime = time.time() - t0

    run_name = _build_run_name(source, k, eps)
    tags = {**DEFAULT_TAGS_CLUSTERING, "source": source, "feature_space": feature_space, "k": str(k), "eps": f"{eps:.3f}"}

    with start_pipeline_run(run_name=run_name, tags=tags, nested=nested):
        log_dataset_info(df_raw, name="grid")
        _log_cluster_params(km_labels, db_labels, k, eps, n_total, runtime, n_noise, sk_kmeans, sk_dbscan_full, sk_dbscan, elbow_df.loc[elbow_df["k"] == k, "inertia"].values[0])

        try:
            from src.visualization import plot_elbow, plot_kdistance, plot_pca_2d, plot_silhouette_by_k
            figs = []
            fig_names = []

            fig_elbow = plot_elbow(elbow_df["k"].values, elbow_df["inertia"].values, knee_k=k)
            figs.append(fig_elbow)
            fig_names.append("elbow_plot")

            fig_sil = plot_silhouette_by_k(silhouette_df["k"].values, silhouette_df["silhouette"].values)
            figs.append(fig_sil)
            fig_names.append("silhouette_plot")

            fig_kdist = plot_kdistance(k_distance_values(X_cluster, k=dbscan_min_samples), k=dbscan_min_samples, eps=eps)
            figs.append(fig_kdist)
            fig_names.append("kdistance_plot")

            if X_pca.shape[1] >= 2:
                df_pca = pd.DataFrame(X_pca[:, :2], columns=["PC1", "PC2"])
                fig_pca_kmeans = plot_pca_2d(df_pca, color_data=km_labels.astype(str), cmap="tab10")
                figs.append(fig_pca_kmeans)
                fig_names.append("pca_kmeans_clusters")

                fig_pca_dbscan = plot_pca_2d(df_pca, color_data=db_labels.astype(str), cmap="tab10")
                figs.append(fig_pca_dbscan)
                fig_names.append("pca_dbscan_clusters")

            log_figures(figs, fig_names)
        except Exception:
            pass

        if save_models:
            os.makedirs(MODELS_DIR, exist_ok=True)
            km_path = os.path.join(MODELS_DIR, "kmeans_model.joblib")
            db_path = os.path.join(MODELS_DIR, "dbscan_model.joblib")
            joblib.dump(km_model, km_path, compress=3)
            joblib.dump(db_model, db_path, compress=3)
            import mlflow
            mlflow.log_artifact(km_path)
            mlflow.log_artifact(db_path)

    return {
        "kmeans_labels": km_labels,
        "dbscan_labels": db_labels,
        "kmeans_model": km_model,
        "dbscan_model": db_model,
        "k": k,
        "eps": eps,
        "silhouette_kmeans": sk_kmeans,
        "silhouette_dbscan": sk_dbscan,
        "n_noise": n_noise,
        "n_db_clusters": n_db_clusters,
    }


def silhouette_score_safe(X, labels):
    from sklearn.metrics import silhouette_score
    unique = np.unique(labels)
    if len(unique) < 2:
        return -1.0
    return float(silhouette_score(X, labels, random_state=RANDOM_STATE))


def run_clustering_full():
    grid_path = DATA_DIR / "grid_features.csv"
    if not grid_path.exists():
        print(f"File not found: {grid_path}")
        return
    df = pd.read_csv(grid_path)
    if "categoria_tormenta" not in df.columns:
        from src.data.adapters import _classify_storm_category
        if "wind_mean" in df.columns:
            df["categoria_tormenta"] = df["wind_mean"].apply(_classify_storm_category)
    result = train_clustering_pipeline(df)
    print(f"Done. K-Means K={result['k']}, DBSCAN eps={result['eps']:.3f}")
    print(f"  K-Means silhouette: {result['silhouette_kmeans']:.4f}")
    print(f"  DBSCAN clusters: {result['n_db_clusters']}, noise: {result['n_noise']} ({result['n_noise']/df.shape[0]*100:.1f}%)")


if __name__ == "__main__":
    run_clustering_full()