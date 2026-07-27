from src.config.mlflow_config import (
    ARTIFACT_PATH,
    DEFAULT_TAGS,
    ENABLE_TRACKING,
    EXPLAINED_VARIANCE_THRESHOLD,
    FIGURES_DIR,
    H3_RESOLUTION,
    MLFLOW_EXPERIMENT,
    MLFLOW_TRACKING_URI,
    MODELS_DIR,
    PCA_SOLVER,
    RANDOM_STATE,
    REGISTER_MODELS,
    RUN_NAME_TEMPLATE,
    SKEW_THRESHOLD,
)

__all__ = [
    "ARTIFACT_PATH",
    "DEFAULT_TAGS",
    "ENABLE_TRACKING",
    "EXPLAINED_VARIANCE_THRESHOLD",
    "FIGURES_DIR",
    "H3_RESOLUTION",
    "MLFLOW_EXPERIMENT",
    "MLFLOW_TRACKING_URI",
    "MLFLOW_CONFIG",
    "MODELS_DIR",
    "PCA_SOLVER",
    "PREPROCESSING_CONFIG",
    "RANDOM_STATE",
    "REGISTER_MODELS",
    "RUN_NAME_TEMPLATE",
    "SKEW_THRESHOLD",
]

PREPROCESSING_CONFIG = {
    "dummy_columns": [
        "categoria_tormenta",
    ],
    "exclude_columns": [
        "lat",
        "lon",
        "cell_id",
    ],
    "target_variance": EXPLAINED_VARIANCE_THRESHOLD,
    "random_state": RANDOM_STATE,
    "h3_resolution": H3_RESOLUTION,
}

MLFLOW_CONFIG = {
    "tracking_uri": MLFLOW_TRACKING_URI,
    "experiment_name": MLFLOW_EXPERIMENT,
    "run_name_template": RUN_NAME_TEMPLATE,
}
