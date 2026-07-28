# GeoRisk Finder

Descubrimiento no supervisado de perfiles de riesgo de catastrofes naturales (sismos, ciclones, volcanes) mediante clustering geoespacial sobre una cuadrícula hexagonal global (H3). Incluye pipeline de datos reproducible, modelado no supervisado (PCA + K-Means/DBSCAN) y dashboard interactivo Streamlit para analisis financiero de alerta temprana.

---

## Equipo y Responsabilidades (Según Reparto Oficial)

| Duo | Miembros | Responsabilidad Principal | Entregables Clave |
|-----|----------|---------------------------|-------------------|
| **Duo A** | **Vanessa** (Sismos) / **David** (Ciclones) | Ingesta y EDA por fuente | 3-4 datasets limpios + notebooks EDA |
| **Duo B** | **Joel** / **Juan** | Grid H3, Feature Engineering, Preprocesamiento, PCA | Dataset "celda x features" + pipeline PCA |
| **Duo C** | **María Isabel** / **Anas** | Modelado (K-Means/DBSCAN), Estabilidad, Interpretación, Producto/Ética/Pitch | Clusters, casos de estudio, análisis ético, demo 3D |

### Detalle por Persona

| Persona | Rol Técnico | Módulos / Notebooks Responsables |
|---------|-------------|-----------------------------------|
| **Vanessa** | Tech Lead Sismos | `01_eda_sismos.ipynb`, `src/usgs_earthquakes.py` (ingesta/limpieza USGS) |
| **David** | Tech Lead Ciclones/Volcanes/IGN | `02_eda_ciclones_volcanes.ipynb`, ingesta IBTrACS/NOAA/IGN |
| **Joel** | Tech Lead Grid H3 + Features | `src/features/grid.py`, `src/features/engineering.py`, `03_grid_y_features.ipynb` |
| **Juan** | **Tech Lead Preprocesamiento + PCA** | `src/preprocessing.py`, `src/data_loader.py`, `04_preprocesamiento_pca.ipynb`, `pipeline_riesgo.joblib` |
| **María Isabel** | Product Owner + Modelado/Ética | `05_modelado_clustering.ipynb` (K-Means), `07_interpretacion_casos_estudio.ipynb`, análisis ético, pitch |
| **Anas** | Tech Lead Clustering/Estabilidad | `src/clustering.py`, `05_modelado_clustering.ipynb` (DBSCAN), `06_evaluacion_estabilidad.ipynb` |

> **Nota:** En la 2ª mitad del proyecto (rotación), **Duo A (Vanessa + David)** construyen la demo 3D (globo + buscador ciudad) mientras Duo B y C cierran modelado. **README final** lo redactan **Joel/Juan (Duo B - datos) + María Isabel/Anas (Duo C - producto)**.

---

## Arquitectura del Proyecto

```
GeoRisk_Finder/
├── data/
│   ├── raw/                      # Datos originales (NO versionar si pesan >50MB)
│   │   └── ibtracs_sample.csv    # Muestra IBTrACS (ciclones)
│   └── processed/                # Datasets listos para modelado
│       ├── usgs_earthquakes_clean.csv   # 79M rows - Sismos globales (M>=4.5, 1900-2026)
│       ├── ciclones_clean.csv           # 46M rows - Trayectorias ciclonicas (IBTrACS)
│       ├── volcanes_clean.csv           # 7.5K rows - Erupciones significativas (NOAA)
│       ├── espana_clean.csv             # 11M rows - Catalogo IGN (Espana + Canarias)
│       ├── grid_features.csv            # 4.5M rows - Features por celda H3 (res=3)
│       ├── cluster_labels.csv           # Etiquetas de cluster por celda
│       ├── interpretacion_clusters.csv  # Perfil de riesgo por cluster
│       └── casos_estudio.csv            # Casos de uso validados
├── notebooks/                    # 7 notebooks secuenciales (ver abajo)
├── src/                          # Codigo reutilizable (importable desde notebooks)
│   ├── config.py                 # Configuracion central (schema, PCA, H3)
│   ├── data_loader.py            # Carga unificada + fallback sintetico
│   ├── usgs_earthquakes.py       # Ingesta USGS (descarga, limpieza, export)
│   ├── h3_aggregator.py          # Agregacion espacial H3 generica
│   ├── features/
│   │   ├── grid.py               # Grid global H3 + asignacion eventos->celdas
│   │   ├── engineering.py        # Features sismicas, ciclonicas, volcanicas
│   │   └── ingestion.py          # Carga fuentes externas
│   ├── preprocessing.py          # Pipeline sklearn: log1p -> OneHot -> StandardScaler -> PCA
│   ├── clustering.py             # K-Means (elbow/silhouette) + DBSCAN (k-dist)
│   └── visualization.py          # Graficos profesionales (Matplotlib/Plotly/Folium)
├── streamlit_app/                # Dashboard financiero catastrofes vs alerta temprana
│   ├── app.py                    # 7 paginas interactivas
│   └── assets/                   # Excel modelo, PDFs, infografias
├── georisk_globe/                # Demo 3D interactiva (Duo A - 2da mitad)
│   ├── message_sender/           # Comunicacion componentes
│   └── layer_panel/              # Panel capas globo
├── outputs/figures/              # Graficos exportados para presentacion
├── tests/                        # Pytest suite (data, preprocessing, clustering, viz)
└── requirements.txt              # Dependencias base
```
GeoRisk_Finder/
├── data/
│   ├── raw/                      # Datos originales (NO versionar si pesan >50MB)
│   │   └── ibtracs_sample.csv    # Muestra IBTrACS (ciclones)
│   └── processed/                # Datasets listos para modelado
│       ├── usgs_earthquakes_clean.csv   # 79M rows - Sismos globales (M≥4.5, 1900-2026)
│       ├── ciclones_clean.csv           # 46M rows - Trayectorias ciclónicas (IBTrACS)
│       ├── volcanes_clean.csv           # 7.5K rows - Erupciones significativas (NOAA)
│       ├── espana_clean.csv             # 11M rows - Catálogo IGN (España + Canarias)
│       ├── grid_features.csv            # 4.5M rows - Features por celda H3 (res=3)
│       ├── cluster_labels.csv           # Etiquetas de cluster por celda
│       ├── interpretacion_clusters.csv  # Perfil de riesgo por cluster
│       └── casos_estudio.csv            # Casos de uso validados
├── notebooks/                    # 7 notebooks secuenciales (ver abajo)
├── src/                          # Código reutilizable (importable desde notebooks)
│   ├── config.py                 # Configuración central (schema, PCA, H3)
│   ├── data_loader.py            # Carga unificada + fallback sintético
│   ├── usgs_earthquakes.py       # Ingesta USGS (descarga, limpieza, export)
│   ├── h3_aggregator.py          # Agregación espacial H3 genérica
│   ├── features/
│   │   ├── grid.py               # Grid global H3 + asignación eventos→celdas
│   │   ├── engineering.py        # Features sísmicas, ciclónicas, volcánicas
│   │   └── ingestion.py          # Carga fuentes externas
│   ├── preprocessing.py          # Pipeline sklearn: log1p → OneHot → StandardScaler → PCA
│   ├── clustering.py             # K-Means (elbow/silhouette) + DBSCAN (k-dist)
│   └── visualization.py          # Gráficos profesionales (Matplotlib/Plotly/Folium)
├── streamlit_app/                # Dashboard financiero catástrofes vs alerta temprana
│   ├── app.py                    # 7 páginas interactivas
│   └── assets/                   # Excel modelo, PDFs, infografías
├── outputs/figures/              # Gráficos exportados para presentación
├── tests/                        # Pytest suite (data, preprocessing, clustering, viz)
└── requirements.txt              # Dependencias base
```

---

## Flujo de Datos (Data Pipeline)

### 1. Ingesta de Fuentes (`src/usgs_earthquakes.py`, `notebooks/01_eda_sismos.ipynb`, `02_eda_ciclones_volcanes.ipynb`)

| Fuente | Cobertura | Registros | Variables clave |
|--------|-----------|-----------|-----------------|
| **USGS Earthquake Catalog** | Global, M≥4.5, 1900-2026 | ~79M | lat, lon, depth_km, magnitude, magType, timestamp |
| **IBTrACS (NOAA)** | Ciclones globales, 1970-2025 | ~46M | lat, lon, wind (knots), pressure (mb), timestamp |
| **NOAA/NCEI Volcanoes** | Erupciones significativas históricas | ~7.5K | lat, lon, elevation, country |
| **IGN (España)** | Sismos España + Canarias, 1900-2026 | ~11M | lat, lon, depth_km, magnitude, mag_type |

**Procesamiento USGS:** Descarga por años (evita límite 20K API), deduplicación por `event_id`, validación coordenadas/magnitud, normalización timestamp UTC, categorización magnitud (minor→great).

**Procesamiento IGN:** Normalización coordenadas históricas escaladas (especialmente Canarias), 96,076 eventos retenidos tras limpieza.

### 2. Grid Espacialización H3 Resolución 3 (`src/features/grid.py`, `src/h3_aggregator.py`)

- **12,588 celdas hexagonales** cubriendo el globo (~12,300 km²/celda)
- Cada evento (sismo, punto de trayectoria ciclón, volcán) → `cell_id` H3
- Grid base generado desde 122 celdas resolución 0 → subdivisión recursiva

### 3. Feature Engineering por Celda (`src/features/engineering.py`)

| Grupo | Features (14 numéricas + 1 categórica) |
|-------|----------------------------------------|
| **Sísmico** | `eq_count`, `eq_mag_mean`, `eq_mag_max`, `eq_depth_mean`, `eq_energy_log`, `eq_days_since_last_major` |
| **Ciclónico** | `cyclone_count`, `wind_mean`, `wind_max`, `pressure_min_mean` |
| **Volcánico** | `dist_nearest_volcano_km`, `volcano_count` |
| **Categórica** | `categoria_tormenta` (TD/TS/C1-C5 según Saffir-Simpson) |

**Ventanas temporales:** Sismos 1900-hoy (cobertura USGS fiable); Ciclones 1970-2025 (era satélite consistente).

**Manejo NaN:** Celdas sin eventos → 0 en conteos, 1013 hPa presión, 20,015 km distancia volcán (antípoda = "no aplica"), 99,999 días desde sismo mayor. Celdas *con* eventos pero intensidad missing → media global del hazard.

### 4. Preprocesamiento + PCA (`src/preprocessing.py`, `notebooks/04_preprocesamiento_pca.ipynb`)

Pipeline **sklearn exportable a joblib**:

1. **SkewLogTransformer** – log1p a columnas con skew > 0.75
2. **OneHotTransformer** – `categoria_tormenta` (drop first)
3. **StandardScaler** – solo numéricas
4. **PCA** – retiene componentes para **≥85% varianza** (resultado: **6 PCs**)

**Outputs:** `df_pca` (PCs), `df_scaled` (features escaladas), `pipeline_riesgo.joblib` (reutilizable en producción).

### 5. Clustering (`src/clustering.py`, `notebooks/05_modelado_clustering.ipynb`)

| Algoritmo | Configuración | Propósito |
|-----------|---------------|-----------|
| **K-Means** | K óptimo por *elbow* + *silhouette* (K=4) | Segmentación negocio: 4 perfiles de riesgo |
| **DBSCAN** | eps por *k-distance* (k=5), min_samples=5 | Detección *outliers* = celdas riesgo atípico (ruido = señal) |

**Evaluación estabilidad** (`notebooks/06_evaluacion_estabilidad.ipynb`): Bootstrap (n=100), Jaccard index entre runs, ARI, análisis sensibilidad eps/min_samples.

### 6. Interpretación & Casos de Estudio (`notebooks/07_interpretacion_casos_estudio.ipynb`)

- Perfil medio de features por cluster → etiquetas semánticas (ej. "Alto riesgo sísmico + volcánico", "Ciclones frecuentes baja intensidad", "Zona tranquila", "Outliers multi-hazard")
- Validación geográfica: Anillo de Fuego, Caribe, Mediterráneo, Atlántico Norte
- Export: `interpretacion_clusters.csv`, `casos_estudio.csv`, `cluster_labels.csv`

---

## Notebooks (Orden de Ejecución)

| # | Notebook | Responsable | Outputs clave |
|---|----------|-------------|---------------|
| 1 | `01_eda_sismos.ipynb` | **David** | USGS raw/clean, EDA sismos global |
| 2 | `02_eda_ciclones_volcanes.ipynb` | **Vanessa** | IBTrACS/NOAA/IGN clean, EDA multi-hazard |
| 3 | `03_grid_y_features.ipynb` | **Joel/Juan** | Grid H3 global, `grid_features.csv` |
| 4 | `04_preprocesamiento_pca.ipynb` | **Juan/Anas** | Pipeline PCA, `pipeline_riesgo.joblib`, varianza explicada |
| 5 | `05_modelado_clustering.ipynb` | **David/Vanessa** | K-Means/DBSCAN labels, gráficos elbow/silhouette/k-dist |
| 6 | `06_evaluacion_estabilidad.ipynb` | **Joel** | Bootstrap stability, Jaccard/ARI, sensibilidad |
| 7 | `07_interpretacion_casos_estudio.ipynb` | **María Isabel/Anas** | Perfiles cluster, casos validados, exports finales |

---

## Dashboard Streamlit (`streamlit_app/`)

**Modelo financiero comparativo:** Coste histórico catástrofes vs inversión en Sistemas Alerta Temprana (EWS).

### 7 Páginas

| Página | Contenido |
|--------|-----------|
| **Resumen Ejecutivo** | KPIs globales, BCR por región, infografía principal |
| **Modelo Financiero** | Tabla KPIs región, inversión vs beneficio |
| **Pérdidas Históricas** | Evolución 2021-2025 por región (Aon/Swiss Re/EM-DAT) |
| **Proyecciones 10 años** | Flujo neto anual, mapa de calor |
| **Comparativa Escenarios** | Conservador / Base / Optimista (editable en Excel) |
| **Documentación** | PDF Resumen Ejecutivo (4 págs) + descargas |
| **Análisis de Sesgos** | 6 sesgos críticos, infografía + PDF completo (7 págs) |

### Datos Base del Modelo
- **Aon** – Climate and Catastrophe Insight 2026
- **Swiss Re Institute** – Pérdidas aseguradas por región
- **EM-DAT / CRED** – Base internacional desastres
- **WMO / UNDRR** – ROI EWS, iniciativa EW4All
- **McKinsey / HBS** – BCR adaptación climática
- **World Bank** – PIB por país/región

### Ejecutar Dashboard
```bash
cd streamlit_app
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
streamlit run app.py
```

---

## Instalación Entorno Completo

```bash
# 1. Clonar repo
git clone <repo-url>
cd GeoRisk_Finder

# 2. Entorno virtual
python -m venv venv
venv\Scripts\activate      # Windows

# 3. Dependencias base (notebooks + src)
pip install -r requirements.txt

# 4. Dependencias dashboard (opcional)
cd streamlit_app && pip install -r requirements.txt && cd ..

# 5. Jupyter Lab
jupyter lab
```

**requirements.txt principal:**
```
pandas numpy scikit-learn matplotlib seaborn plotly streamlit h3 requests scipy
joblib folium ydata-profiling missingno pre-commit pydeck streamlit-deckgl branca streamlit-folium
```

---

## Ejecución Reproducible del Pipeline

### Opción A: Notebooks secuenciales (recomendado para exploración)
```bash
jupyter lab
# Ejecutar 01 → 07 en orden
```

### Opción B: Scripts directos (para automatización)
```bash
# Ingesta USGS completa (descarga ~79M registros, tarda ~30-60 min)
python -m src.usgs_earthquakes

# Generar grid + features (requiere CSVs limpios en data/processed/)
python -c "
from src.features.grid import build_global_grid
from src.features.engineering import compute_seismic_features, compute_cyclone_features, compute_volcanic_features
import pandas as pd

grid = build_global_grid(resolution=3)
eq = pd.read_csv('data/processed/usgs_earthquakes_clean.csv')
cy = pd.read_csv('data/processed/ciclones_clean.csv')
vo = pd.read_csv('data/processed/volcanes_clean.csv')

seismic = compute_seismic_features(eq)
cyclone = compute_cyclone_features(cy)
volcanic = compute_volcanic_features(grid, vo)

# Merge manual o via h3_aggregator.merge_h3_datasets
"
```

### Opción C: Cargar dataset final directamente (rápido)
```python
from src.data_loader import load_combined_data
df = load_combined_data()  # Carga grid_features.csv + deriva categoria_tormenta
```

---

## Testing

```bash
# Suite completa
pytest tests/ -v

# Por módulo
pytest tests/test_data_loader.py -v
pytest tests/test_preprocessing.py -v
pytest tests/test_clustering.py -v
pytest tests/test_visualization.py -v
```

**Cobertura:** Data loading (synthetic fallback), preprocessing (skew, dummies, scaler, PCA), clustering (elbow, silhouette, k-dist, DBSCAN), visualización (figuras se generan sin error).

---

## Outputs Principales (para presentación)

### Gráficos (`outputs/figures/`)
| Archivo | Descripción |
|---------|-------------|
| `explained_variance.png` | Varianza acumulada PCA (threshold 85%) |
| `pca_2d.png` / `pca_3d.html` | Proyección PC1-PC2 / PC1-PC2-PC3 interactiva |
| `loadings_heatmap.png` | Contribución features originales a PCs |
| `elbow_plot.png` / `silhouette_plot.png` | Selección K óptimo |
| `kdistance_plot.png` | Selección eps DBSCAN |
| `pca_kmeans_clusters.png` / `pca_dbscan_clusters.png` | Clusters en espacio PCA |
| `cluster_map.html` | Mapa Folium interactivo clusters + ruido |
| `mapa_frecuencia_sismica.png` / `grid_global_h3.png` | Contexto geoespacial |

### Datos Procesados (`data/processed/`)
| Archivo | Filas | Uso |
|---------|-------|-----|
| `grid_features.csv` | ~4.5M | Dataset modelado (celda × 15 features) |
| `cluster_labels.csv` | ~4.5M | `cell_id`, `lat`, `lon`, `kmeans_cluster`, `dbscan_cluster` |
| `interpretacion_clusters.csv` | 4-5 | Perfil medio + etiqueta semántica por cluster |
| `casos_estudio.csv` | ~10 | Validación geográfica manual |

### Modelo Financiero (`streamlit_app/assets/`)
| Archivo | Descripción |
|---------|-------------|
| `Modelo_Catastrofes_Alerta_Temprana.xlsx` | 6 hojas: Supuestos, KPIs, Proyecciones, Escenarios, Sensibilidad, Datos base |
| `Resumen_Ejecutivo_Catastrofes_EWS.pdf` | 4 páginas lista para dirección |
| `Analisis_Sesgos_Modelo_Catastrofes.pdf` | 7 páginas análisis crítico |
| `infografia_completa.png` / `infografia_sesgos.png` | Gráficos para slides |

---

## Decisiones Técnicas Clave

| Decisión | Justificación |
|----------|---------------|
| **H3 Resolución 3** | Balance granularidad global (~12K celdas) vs computación tractable; ~12,300 km²/celda captura variabilidad regional |
| **PCA 85% varianza → 6 PCs** | Reduce 15 features → 6 componentes interpretables, elimina multicolinealidad, acelera clustering |
| **K-Means K=4** | Elbow + silhouette coinciden; 4 segmentos accionables para negocio (bajo/medio/alto/outlier) |
| **DBSCAN ruido = señal** | Outliers = combinaciones raras multi-hazard (ej. sismo extremo + ciclón + volcán) = alto valor riesgo |
| **NaN distancia volcán = 20,015 km** | Antípoda = "no hay volcán relevante", consistente con 99,999 días sismo mayor |
| **Ventana ciclones 1970-2025** | Cobertura satelital consistente; pre-1970 sesgo observacional severo |
| **Pipeline joblib exportable** | Reentrenamiento en producción con mismos pasos, versionado, CI/CD ready |

---

## Próximos Pasos / Roadmap

- [ ] **Modelado supervisado**: Entrenar clasificador riesgo (target: cluster labels) para inferencia en nuevas celdas
- [ ] **API REST**: FastAPI sirviendo pipeline + predicción cluster para coordenadas ad-hoc
- [ ] **Incorporar hazard hidrológico**: Inundaciones (DFO/GLOFAS) + deslizamientos (NASA LHASA)
- [ ] **Validación temporal**: Train 1900-2000 → Test 2000-2026 (estabilidad clusters en el tiempo)
- [ ] **Dashboard unificado**: Integrar clustering GeoRisk + modelo financiero EWS en single app
- [ ] **CI/CD**: GitHub Actions (tests + lint + build docker) → deploy Streamlit Cloud / HuggingFace Spaces

---

## Licencia

Uso académico / interno. Datos fuentes: USGS (dominio público), IBTrACS/NOAA (dominio público), IGN (licencia abierta), Aon/Swiss Re/EM-DAT (citados en dashboard).

---

## Contacto

**Product Owner:** María Isabel  
**Scrum Master:** Joel  
**Tech Leads:** David (sismos), Vanessa (ciclones/volcanes), Juan (pipeline/architectura), Anas (clustering/validación)