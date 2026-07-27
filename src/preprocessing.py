import os
import time
import warnings

import joblib
import mlflow
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer, make_column_selector
from sklearn.decomposition import PCA
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from src.config.mlflow_config import (
    EXPLAINED_VARIANCE_THRESHOLD,
    FIGURES_DIR,
    H3_RESOLUTION,
    MODELS_DIR,
    PCA_SOLVER,
    RANDOM_STATE,
    RUN_NAME_TEMPLATE,
    SKEW_THRESHOLD,
)
from src.utils.mlflow_utils import (
    log_dataframe_schema,
    log_dataset_info,
    log_figures,
    log_model,
    setup_mlflow,
    start_pipeline_run,
)


def detect_skew_columns(df: pd.DataFrame, threshold: float = 0.75) -> list:
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.empty:
        return []
    skewness = numeric_df.skew().abs()
    return skewness[skewness > threshold].index.tolist()


class SkewLogTransformer(BaseEstimator, TransformerMixin):
    def __init__(self, threshold: float = 0.75):
        self.threshold = threshold
        self.skew_cols_: list = []

    def fit(self, X: pd.DataFrame, y=None):
        self.skew_cols_ = detect_skew_columns(X, threshold=self.threshold)
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        df = X.copy()
        for col in self.skew_cols_:
            if col in df.columns:
                df[f"{col}_log"] = np.log1p(df[col].clip(lower=0))
        return df.drop(columns=[c for c in self.skew_cols_ if c in df.columns])


class OneHotTransformer(BaseEstimator, TransformerMixin):
    def __init__(self, columns: list | None = None):
        self.columns = columns or ["categoria_tormenta"]
        self.dummy_cols_: list = []
        self.dummy_cols_used_: list = []

    def fit(self, X: pd.DataFrame, y=None):
        self.dummy_cols_ = [c for c in self.columns if c in X.columns]
        if self.dummy_cols_:
            dummies = pd.get_dummies(X[self.dummy_cols_])
            drop_col = dummies.columns[0]
            self.dummy_cols_used_ = [c for c in dummies.columns if c != drop_col]
        else:
            self.dummy_cols_used_ = []
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        df = X.copy()
        if self.dummy_cols_:
            dummies = pd.get_dummies(df[self.dummy_cols_])
            dummies = dummies.reindex(columns=self.dummy_cols_used_, fill_value=0)
            df = pd.concat([df.drop(columns=self.dummy_cols_), dummies], axis=1)
        return df


def _build_pipeline(target_variance: float, random_state: int) -> Pipeline:
    return Pipeline(
        [
            ("log_skew", SkewLogTransformer(threshold=SKEW_THRESHOLD)),
            ("onehot", OneHotTransformer()),
            (
                "scaler",
                ColumnTransformer(
                    [
                        (
                            "scaler",
                            StandardScaler(),
                            make_column_selector(dtype_include=np.number),
                        )
                    ],
                    remainder="passthrough",
                ),
            ),
            ("pca", PCA(random_state=random_state, svd_solver=PCA_SOLVER)),
        ]
    )


def _prepare_features(df_raw: pd.DataFrame) -> tuple[pd.DataFrame, list]:
    exclude = {"lat", "lon", "cell_id"}
    numeric_cols = [
        c for c in df_raw.select_dtypes(include=[np.number]).columns
        if c not in exclude
    ]
    dummy_cols = [c for c in ["categoria_tormenta"] if c in df_raw.columns]
    feature_cols = numeric_cols + dummy_cols
    X_prep = df_raw[feature_cols].copy()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FutureWarning)
        numeric_for_median = X_prep.select_dtypes(include=[np.number]).columns
        X_prep[numeric_for_median] = X_prep[numeric_for_median].fillna(
            X_prep[numeric_for_median].median()
        )
    return X_prep, feature_cols


def _make_run_name(source: str, n_samples: int, n_features: int, n_pc: int, var_pct: float) -> str:
    return RUN_NAME_TEMPLATE.format(
        source=source.upper(),
        n_samples=n_samples,
        n_features=n_features,
        n_pc=n_pc,
        var_pct=var_pct,
    )


def preprocessing_pca_pipeline(
    df_raw: pd.DataFrame,
    target_variance: float = EXPLAINED_VARIANCE_THRESHOLD,
    save_path: str | None = os.path.join(MODELS_DIR, "pipeline_riesgo.joblib"),
) -> tuple:
    setup_mlflow()
    source = "real" if df_raw.shape[0] > 5000 else "test"

    X_prep, feature_cols = _prepare_features(df_raw)
    missing_before = int(X_prep.isna().sum().sum())
    pipeline = _build_pipeline(target_variance, RANDOM_STATE)

    run_name = f"{source.upper()} {X_prep.shape[0]}x{X_prep.shape[1]}"
    tags = {"source": source, "data_shape": f"{X_prep.shape[0]}x{X_prep.shape[1]}"}

    with start_pipeline_run(run_name=run_name, tags=tags):
        t0 = time.time()

        log_dataset_info(X_prep, name="input")
        log_dataframe_schema(X_prep)

        mlflow_params = {
            "h3_resolution": H3_RESOLUTION,
            "skew_threshold": SKEW_THRESHOLD,
            "target_variance": target_variance,
            "random_state": RANDOM_STATE,
            "pca_solver": PCA_SOLVER,
            "n_features_input": X_prep.shape[1],
            "n_samples": X_prep.shape[0],
            "missing_values_before": missing_before,
        }

        pipeline.fit(X_prep)
        pca = pipeline.named_steps["pca"]
        cum_var_full = np.cumsum(pca.explained_variance_ratio_)

        n_keep = int(np.searchsorted(cum_var_full, target_variance) + 1)
        pipeline.set_params(pca__n_components=n_keep)
        pipeline.fit(X_prep)

        pca = pipeline.named_steps["pca"]
        cum_var = np.cumsum(pca.explained_variance_ratio_)
        explained_var = float(cum_var[n_keep - 1])

        remaining_cols = X_prep.shape[1]
        missing_after = 0

        mlflow_params["n_features_after_skew"] = remaining_cols
        mlflow_params["scaler"] = "StandardScaler"
        mlflow_params["imputer"] = "median"

        mlflow.log_params(mlflow_params)
        mlflow.log_metrics({
            "explained_variance": explained_var,
            "n_components": n_keep,
            "missing_values_before": missing_before,
            "missing_values_after": missing_after,
            "n_components_initial": len(cum_var_full),
        })

        full_name = _make_run_name(
            source, X_prep.shape[0], X_prep.shape[1], n_keep, explained_var
        )
        mlflow.set_tag("summary", full_name)

        X_full = pipeline.transform(X_prep)
        df_pca = pd.DataFrame(
            X_full,
            columns=[f"PC{i + 1}" for i in range(n_keep)],
            index=df_raw.index,
        )

        X_after_log = pipeline.named_steps["log_skew"].transform(X_prep)
        X_after_dummies = pipeline.named_steps["onehot"].transform(X_after_log)
        X_scaled = pipeline.named_steps["scaler"].transform(X_after_dummies)

        try:
            scaled_names = pipeline.named_steps["scaler"].get_feature_names_out()
        except Exception:
            scaled_names = [f"V{i}" for i in range(X_scaled.shape[1])]

        df_scaled = pd.DataFrame(
            X_scaled,
            columns=scaled_names,
            index=df_raw.index,
        )

        runtime = time.time() - t0
        mlflow.log_metric("runtime_seconds", round(runtime, 2))

        log_model(pipeline, "pipeline_riesgo")

        try:
            from src.visualization import (
                plot_cumulative_variance,
                plot_loadings_heatmap,
                plot_pairplot_pca,
                plot_pca_2d,
            )

            os.makedirs(FIGURES_DIR, exist_ok=True)
            figs = []
            fig_names = []

            fig_var = plot_cumulative_variance(pca, threshold=target_variance)
            figs.append(fig_var)
            fig_names.append("explained_variance")

            fig_2d = plot_pca_2d(df_pca, pca_model=pca)
            figs.append(fig_2d)
            fig_names.append("pca_2d")

            scaled_feature_names = [
                c for c in scaled_names if not c.startswith("remainder__")
            ]
            if scaled_feature_names:
                fig_load = plot_loadings_heatmap(
                    pca, scaled_feature_names, n_components=min(6, n_keep)
                )
                figs.append(fig_load)
                fig_names.append("loadings_heatmap")

            if n_keep >= 2:
                fig_pair = plot_pairplot_pca(df_pca, n_components=min(4, n_keep))
                figs.append(fig_pair)
                fig_names.append("pairplot_pca")

            log_figures(figs, fig_names)
        except Exception:
            pass

        if save_path:
            os.makedirs(os.path.dirname(save_path) or ".", exist_ok=True)
            joblib.dump(pipeline, save_path, compress=3)
            mlflow.log_artifact(save_path)

    return df_pca, pipeline, df_scaled


def load_pipeline(path: str) -> Pipeline:
    return joblib.load(path)


def transform_new_data(pipeline: Pipeline, df_new: pd.DataFrame) -> np.ndarray:
    exclude = {"lat", "lon", "cell_id"}
    numeric_cols = [
        c for c in df_new.select_dtypes(include=[np.number]).columns
        if c not in exclude
    ]
    dummy_cols = [c for c in ["categoria_tormenta"] if c in df_new.columns]
    feature_cols = numeric_cols + dummy_cols
    X = df_new[feature_cols].copy()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FutureWarning)
        numeric_for_median = X.select_dtypes(include=[np.number]).columns
        X[numeric_for_median] = X[numeric_for_median].fillna(
            X[numeric_for_median].median()
        )
    return pipeline.transform(X)
