MLFLOW_EXPERIMENT = "georisk_preprocessing"
MLFLOW_EXPERIMENT_CLUSTERING = "georisk_clustering"
MLFLOW_TRACKING_URI = "sqlite:///mlflow.db"
ENABLE_TRACKING = True
REGISTER_MODELS = True
ARTIFACT_PATH = "pipeline_riesgo"

RUN_NAME_TEMPLATE = "{source} {n_samples}x{n_features} -> {n_pc} PC ({var_pct:.0f}% var)"

CLUSTER_RUN_NAME_TEMPLATE = "{source} K={k} eps={eps:.2f}"

FIGURES_DIR = "outputs/figures"
MODELS_DIR = "models"

DEFAULT_TAGS = {
    "project": "georisk_finder",
    "dataset": "grid_features",
    "environment": "development",
    "pipeline_version": "1.0.0",
}

DEFAULT_TAGS_CLUSTERING = {
    "project": "georisk_finder",
    "task": "clustering",
    "dataset": "grid_features",
    "environment": "development",
}

EXPLAINED_VARIANCE_THRESHOLD = 0.85
RANDOM_STATE = 42
H3_RESOLUTION = 3
SKEW_THRESHOLD = 0.75
PCA_SOLVER = "auto"
KMEANS_K_RANGE = (2, 10)
KMEANS_DEFAULT_K = 5
DBSCAN_MIN_SAMPLES = 5
CLUSTER_FEATURE_SPACE = "scaled"

FIGURES_DIR = "outputs/figures"
MODELS_DIR = "models"
