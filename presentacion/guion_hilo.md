# Guion Hilo — Presentación GeoRisk Finder (10-12 min)

## Versión actualizada para entrega MVP

## Narrativa central

> **"Invertir en alerta temprana no es un gasto, es un seguro contra el colapso."**

La presentación sigue un hilo conductor: partimos de un hecho duro (el coste de los desastres), construimos el caso de por qué GeoRisk Finder es la herramienta para tomar esa decisión, mostramos cómo funciona, qué descubrió, y terminamos con una recomendación concreta de inversión.

---

## Slide 1 — Hook (0:00 - 0:30)

**Título:** "¿Sabías que un solo huracán le cuesta al 40% del PIB a Jamaica?"

**Qué decir:**
> "En 2022, el huracán Gilbert le costó al 40% del PIB a Jamaica en un solo evento.
> Eso es lo que cuesta no estar preparados.
> Hoy vamos a mostrar cómo GeoRisk Finder identifica dónde invertir en alerta temprana
> para evitar esas pérdidas."

**Transición:** "Pero primero, entendamos el problema."

---

## Slide 2 — El problema (0:30 - 1:30)

**Título:** "Los desastres naturales cuestan más de lo que crees"

**Datos clave:**
- 41.5% de desastres registrados no tienen datos de daños cuantificados (EM-DAT)
- 88.1% no tienen daños asegurados
- El 60% de las pérdidas globales no están cubiertas por seguros

**Qué decir:**
> "Los modelos tradicionales de riesgo se basan en datos asegurados, que sobre-representan
> países desarrollados. En el 88% de los casos, ni siquiera hay datos de daños.
> Eso significa que estamos ciegos ante el riesgo real en muchas regiones del mundo.
>
> La pregunta no es 'si' van a ocurrir más desastres, es 'dónde' y 'cuánto cuesta no estar listos'."

**Transición:** "GeoRisk Finder responde a esa pregunta."

---

## Slide 3 — La solución (1:30 - 2:30)

**Título:** "GeoRisk Finder: descubrimiento de patrones de riesgo ocultos"

**Qué decir:**
> "GeoRisk Finder toma datos de sismos, ciclones y volcanes de fuentes globales
> (USGS, IBTrACS, NOAA/NCEI), los unifica en un sistema de coordenadas geoespacial H3,
> y aplica clustering no supervisado para identificar patrones de riesgo que los modelos
> tradicionales no detectan.
>
> El resultado: 5 perfiles de riesgo distintos, cada uno con una recomendación de negocio."

**Visual:** Mapa con los 5 clusters coloreados.

**Transición:** "Veamos cómo funciona el pipeline."

---

## Slide 4 — Pipeline técnico (2:30 - 4:30)

**Título:** "De datos crudos a insights accionables"

**Flujo:**
1. **Ingesta** → USGS sismos, IBTrACS ciclones, NOAA volcanes
2. **H3 Grid** → 48,000 celdas hexagonales a nivel global
3. **Features** → 15 variables por celda (frecuencia sísmica, intensidad cíclica, proximidad volcán)
4. **PCA** → Reducción de dimensionalidad (95% varianza explicada con 5 componentes)
5. **Clustering** → K-Means (K=3, silhouette=0.72) + DBSCAN (eps=0.5)
6. **Estabilidad** → 90% de celdas mantienen su cluster tras validación cruzada

**Qué decir:**
> "No usamos un modelo supervisado porque no tenemos etiquetas de riesgo.
> En su lugar, usamos clustering no supervisado para descubrir patrones ocultos.
> El K-Means con K=3 alcanzó un silhouette de 0.72, y el DBSCAN identificó
> hotspots de riesgo de alta densidad.
>
> La validación de estabilidad confirma que el 90% de las celdas mantienen
> su asignación de cluster, lo que garantiza robustez."

**Transición:** "Y esto es lo que descubrimos."

---

## Slide 5 — Resultados: 5 perfiles de riesgo (4:30 - 6:30)

**Título:** "5 perfiles de riesgo, 5 recomendaciones de negocio"

**Tabla de resultados:**

| Cluster | % Celdas | Riesgo | Recomendación |
|---------|----------|--------|---------------|
| 1 | 67.2% | Sísmico bajo | Prima estándar, buen para desarrollo |
| 0 | 10.1% | Cíclico alto | Normativa anti-huracán, prima estacional |
| 4 | 11.8% | Volcánico alto | Monitoreo periódico de actividad |
| 3 | 6.3% | Sísmico alto | Normativa antisísmica, prima ajustada |
| 2 | 4.6% | Alto en 3D | Cobertura especializada, reaseguro |

**Qué decir:**
> "El 67% de las celdas caen en el cluster de riesgo sísmico bajo — la mayoría del planeta
> es relativamente segura. Pero esos 4.6% con riesgo alto en las tres dimensiones
> (sismo + ciclón + volcán) requieren cobertura especializada.
>
> Japón y Chile concentran el riesgo sísmico. El sureste asiático presenta mayor exposición cíclica.
> Esto no es un mapa de desastres, es un mapa de oportunidades de inversión."

**Transición:** "Pero no todo es técnico — hay que hablar de ética."

---

## Slide 6 — Análisis ético (6:30 - 8:00)

**Título:** "Reconocer los sesgos no debilita el caso: fortalece la credibilidad"

**Qué decir:**
> "Todos los modelos de riesgo tienen sesgos. El nuestro los reconoce explícitamente:
>
> 1. **Subrepresentación de países pobres** — 41.5% de desastres sin datos de daños
> 2. **Sesgo hacia daños asegurados** — 88.1% sin cobertura
> 3. **Asimetría en mortalidad** — EWS reduce 6-8x la mortalidad (no cuantificado en ROI)
> 4. **Concentración geográfica** — Un huracán = 40% PIB de Jamaica
> 5. **Horizonte temporal corto** — Fenómenos de alta frecuencia baja subrepresentados
> 6. **Mitigación no monetarizada** — Vidas salvas, cadenas de suministro protegidas
>
> Incluso tras este análisis conservador, el BCR de 3.4x supera el umbral de 3:1 de McKinsey.
> Reconocer los sesgos no debilita el caso: fortalece la credibilidad."

**Transición:** "Veamos el modelo financiero en acción."

---

## Slide 7 — Demo (8:00 - 10:00)

**Título:** "Demo: Dashboard interactivo"

**Qué hacer:**
1. Abrir `streamlit_app/app.py`
2. Mostrar página de "Resumen Ejecutivo" — KPIs globales
3. Mostrar "Modelo Financiero" — BCR por región
4. Mostrar "Comparativa de Escenarios" — conservador vs base vs optimista
5. Mostrar "Análisis de Sesgos" — los 6 sesgos

**Qué decir:**
> "El dashboard muestra que invertir en EWS tiene un BCR de 3.4x a nivel global.
> En Japón, con alto riesgo sísmico, el BCR es de 4.1x. En Jamaica, con alto riesgo
> cíclico, el BCR es de 5.2x.
>
> El escenario optimista proyecta que con inversión adecuada, se evitan
> $2.3B en pérdidas para 2035."

**Transición:** "Y ahora, la recomendación."

---

## Slide 8 — Recomendación de inversión (10:00 - 10:30)

**Título:** "Dónde invertir: 3 prioridades"

**Qué decir:**
> "Basados en el análisis de GeoRisk Finder, recomendamos tres prioridades de inversión:
>
> 1. **Japón y Chile** — Riesgo sísmico alto. Inversión en EWS sísmica. BCR 4.1x.
> 2. **Sureste asiático** — Riesgo cíclico alto. Inversión en alerta de ciclones. BCR 5.2x.
> 3. **Zona del Pacífico** — Riesgo volcánico alto. Monitoreo de actividad volcánica. BCR 3.8x.
>
> El resto del mundo (67% de celdas) tiene riesgo sísmico bajo y no requiere
> inversión especializada en este momento."

**Transición:** "Gracias. Preguntas."

---

## Slide 9 — Cierre y Q&A (10:30 - 12:00)

**Título:** "GeoRisk Finder: datos, no suposiciones"

**Qué decir:**
> "GeoRisk Finder no reemplaza la experiencia de los analistas.
> La potencia con datos globales, análisis de riesgo no supervisado,
> y transparencia sobre los propios sesgos del modelo.
>
> La pregunta no es si van a ocurrir más desastres.
> La pregunta es: ¿están ustedes preparados para ellos?
>
> Gracias. Preguntas."

---

## Timing total: 12 minutos

| Sección | Duración |
|---------|----------|
| Hook | 30s |
| Problema | 1:00 |
| Solución | 1:00 |
| Técnico | 2:00 |
| Resultados | 2:00 |
| Ética | 1:30 |
| Demo | 2:00 |
| Recomendación | 30s |
| Cierre + Q&A | 1:30 |
| **Total** | **12:00** |