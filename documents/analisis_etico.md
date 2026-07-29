# Análisis Ético — GeoRisk Finder

## Sesgos algorítmicos identificados

### Contexto
Todos los modelos de riesgo de catástrofes naturales están sujetos a sesgos inherentes
a sus datos de origen. Reconocerlos no debilita el caso de negocio: el BCR conservador
de 3.4x se mantiene incluso tras este análisis crítico, por encima del umbral de 3:1
recomendado por McKinsey.

---

### Sesgo 1: Subrepresentación de países de bajos ingresos
EM-DAT regista que el 41.5% de los desastres naturales carecen de datos de daños
cuantificados. La mayoría corresponden a países en desarrollo donde la infraestructura
de monitoreo es limitada. El modelo puede subestimar el riesgo en estas regiones
por ausencia de datos, no porque el riesgo sea menor.

### Sesgo 2: Sesgo hacia daños asegurados
El 88.1% de los desastres naturales no tienen daños asegurados (EM-DAT). El modelo
financiero se basa en datos asegurados que sobre-representan países desarrollados
con mercados de seguros maduros, infravalorando sistemáticamente el impacto en
economías donde la cobertura de seguros es baja o inexistente.

### Sesgo 3: Asimetría en la medición de mortalidad
La mortalidad con sistemas de alerta temprana (EWS) es 6-8x menor que sin ellos
(No incorporado en el ROI actual de la ONU/EW4All). Si el modelo no cuantifica
explícitamente el valor de las vidas salvadas, subestima el retorno social de la
inversión en EWS.

### Sesgo 4: Concentración geográfica del impacto
Un solo huracán puede representar el 40% del PIB de un país pequeño como Jamaica.
El modelo promedio por región oculta la asimetría de impacto: para países grandes
el efecto es marginal, pero para naciones insulares o costeras pequeñas es existencial.

### Sesgo 5: Horizonte temporal corto
Las pérdidas históricas usadas para calibrar el modelo cubren 2021-2025. Fenómenos
de alto impacto pero baja frecuencia (tsunamis, erupciones volcánicas mayores) quedan
subrepresentados en la muestra de entrenamiento del modelo financiero.

### Sesgo 6: Sesgo de mitigación no monetarizado
El modelo cuantifica pérdidas evitables (daños evitados por EWS) pero no monetariza
los beneficios no directos: displaciamiento evitado, reconstrucción no necesaria,
impacto en cadenas de suministro globales, costo emocional y pérdida de vidas.
Esto genera una subestimación sistemática del ROI real de las inversiones en alerta temprana.

---

## KPIs de sesgo

| Métrica | Valor | Fuente |
|---------|-------|--------|
| Desastres sin datos de daños | 41.5% | EM-DAT |
| Desastres sin daños asegurados | 88.1% | EM-DAT |
| Reducción de mortalidad con EWS | 6-8x | ONU/EW4All (no en ROI) |
| PIB perdido por un solo evento | 40% | Jamaica (1 huracán) |

---

## Conclusión

Reconocer los sesgos no debilita el caso de inversión: incluso en el escenario
conservador, el BCR de 3.4x supera el umbral mínimo de 3:1. La inclusión de estas
salvedades fortalece la credibilidad del modelo y permite una toma de decisiones
más informada y ética.

---

## Fuentes

- Aon — Climate and Catastrophe Insight 2026
- Swiss Re Institute — Pérdidas aseguradas por región
- EM-DAT / CRED — Base de datos internacional de desastres
- ONU / WMO — Initiative EW4All
- McKinsey / HBS — BCR de adaptación climática
- Banco Mundial — PIB por país/región