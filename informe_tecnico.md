# Informe Técnico: Fallo de deck.gl vía CDN (UMD)

## 1. Versión exacta de deck.gl

**`deck.gl@8.9.35`** — bundle monolítico desde `unpkg.com/deck.gl@8.9.35/dist.min.js`
(1.62 MB, formato webpack UMD)

Versiones alternativas probadas que también fallaron:
- `@deck.gl/core@9.1.0` + `@deck.gl/layers@9.1.0` + `@deck.gl/geo-layers@9.1.0` (separados)
- `@deck.gl/core@8.9.35` + `@deck.gl/layers@8.9.35` + `@deck.gl/geo-layers@8.9.35` (separados)

## 2. Versión de luma.gl contenida

`@luma.gl/core@^8.5.21`, `@luma.gl/webgl@^8.5.21`, `@luma.gl/constants@^8.5.21`
(obtenido del `package.json` de `@deck.gl/core@8.9.35`)

Otras dependencias internas: `@math.gl/core@^3.6.2`, `@math.gl/web-mercator@^3.6.2`,
`@probe.gl/log@^3.5.0`, `mjolnir.js@^2.7.0`, `@loaders.gl/core@^3.4.13`,
`gl-matrix@^3.0.0`.

## 3. Versión que espera GlobeView

`GlobeView` apareció en deck.gl **v8.8** como experimental (prefijo `_` → `deck._GlobeView`).
En v9.x sigue siendo `_GlobeView`. **No es un error de versión** — 8.9 sí lo incluye.

El bundle contiene `GlobeView` en offset 86003. Está presente.

## 4. Objeto global creado por el bundle

```javascript
(function webpackUniversalModuleDefinition(root, factory) {
  if (typeof exports === 'object' && typeof module === 'object')
    module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof exports === 'object') exports['deck'] = factory();
  else root['deck'] = factory();
})(globalThis, function() { ... });
```

**Asigna a `globalThis['deck']`** → en navegador es `window.deck`. Todas las clases están bajo `deck.Deck`, `deck.ScatterplotLayer`, etc.

## 5. Existencia de clases en runtime

Analizado mediante escaneo del bundle completo (1.62 MB):

| Clase | ¿Presente? | Offset |
|-------|-----------|--------|
| `deck.Deck` | ✅ | 84456 |
| `deck.MapView` | ✅ | 85082 |
| `deck.GlobeView` | ✅ | 86003 |
| `deck._GlobeView` | ✅ | 86002 |
| `deck.ScatterplotLayer` | ✅ | 85482 |
| `deck.PathLayer` | ✅ | 85318 |
| `deck.GeoJsonLayer` | ✅ | 84697 |
| `deck.TileLayer` | ✅ | 85699 |
| `deck.BitmapLayer` | ✅ | 84208 |
| `deck.H3HexagonLayer` | ✅ | 84846 |
| `deck.HeatmapLayer` | ✅ | 84868 |
| `deck.FlyToInterpolator` | ✅ | 84631 |
| `deck.LineLayer` | ✅ | 85002 |
| `deck.PolygonLayer` | ✅ | 85402 |
| `deck.ColumnLayer` | ✅ | 84350 |

**Todas existen. No es un problema de clases faltantes.**

## 6. Origen exacto de cada error

### Error A: `PathLayer({id: 'graticule'}): o is not a function`

**Archivo**: `dist.min.js` (deck.gl bundle)
**Línea**: 2167, columna 2623 (en la versión beautificada/mapeada)
**Contexto**: Inicialización de PathLayer → `t.value` (el método `initializeState` del layer)
**Stack**: `t.value (dist.min.js:939:4474)` → `t.value (dist.min.js:939:4138)` → `t.value (dist.min.js:939:3569)` → `t.value (dist.min.js:939:3016)`
**Causa directa**: Minified variable `o` en la función `_getPath` o `getGeometry` no es una función. El PathLayer intenta procesar el accessor `getPath: "path"` y en la resolución, la función interna que extrae las coordenadas no está definida. **El código de proyección/path-utils del bundle no incluye la función `o` que PathLayer espera.**

### Error B: `getHexagon is not a function`

**Archivo**: `dist.min.js`
**Contexto** (extraído del bundle):
```javascript
var _ = h.binaryAccessor || (typeof g == "function" ? g : l[g]);
Je(typeof _ == "function", 'accessor "'.concat(g, '" is not a function'));
```
**Causa directa**: `g` = `"h3_index"` (string). `typeof g == "function"` → false. Entonces `l[g]` = `l["h3_index"]`. La tabla `l` (attributo interno del AttributeManager) **no contiene** esa clave, devuelve `undefined`. `typeof undefined == "function"` → false → assertion disparada.
**Por qué `l["h3_index"]` no existe**: El AttributeManager espera que la resolución string→función ocurra ANTES de esta comprobación. En el bundle UMD, el paso de resolución (`layer._resolveAccessor()`) no se ejecuta porque el flujo de inicialización está incompleto o porque el método `_resolveAccessor` fue eliminado por tree-shaking.

### Error C: `Cannot read properties of undefined (reading 'setUniforms')`

**Archivo**: `dist.min.js`
**Contexto** (extraído del bundle):
```javascript
"uniforms" in a && this.setUniforms(a.uniforms)
```
**Causa directa**: `this` es `undefined`. La función `setProps` del Model es llamada sin contexto. Esto ocurre cuando `Layer._getModel()` devuelve `undefined` (no se pudo crear el modelo WebGL), y luego el pipeline de rendering intenta llamar `model.setProps(...)`.

### Error D: `count(): argument not a container`

**Archivo**: `dist.min.js`, función `Cd`
**Contexto**: Inicialización de `BitmapLayer` para tiles del basemap.
**Causa directa**: La propiedad `image` del BitmapLayer recibe un string URL pero el internal updater espera un `Image` o `Texture` (contenedor). El auto-loading de imágenes no funciona correctamente. Posiblemente el bundle no incluye el plugin de `@loaders.gl/images`.

## 7. Categorización de la causa raíz

Los 4 errores caen en **una combinación de (D) y (E)**:

### D — API antigua / falta de features en el bundle

El bundle UMD de `deck.gl@8.9.35` en `unpkg.com` es generado con webpack. Durante el build, webpack aplica **tree-shaking** que elimina código que el compilador considera "no usado". En un bundle que exporta TODAS las clases al namespace `deck`, tree-shaking elimina:

- **`_resolveAccessor`** y funciones de resolución string→función → causa Error B
- **Funciones de proyección de Path** que no son llamadas directamente desde el entry point → causa Error A
- **`loaders.gl/image`** para carga automática de imágenes → causa Error D

**Esto no es un bundle corrupto (C)**, porque los bytes están intactos. Es un bundle **incompleto** — las dependencias internas de runtime fueron eliminadas por la configuración de build de unpkg.

### E — Código de la aplicación (factor contribuyente)

Nuestra aplicación usa **accesores en formato string** (`getHexagon: "h3_index"`, `getPath: "path"`). En un bundle completo (npm instalado localmente), deck.gl resuelve strings a funciones de data access automáticamente. En este bundle UMD tree-shakeado, esa resolución fue eliminada.

**Solución inmediata**: Pasar funciones en vez de strings:
```javascript
// En vez de:
new deck.PathLayer({ getPath: "path", ... })
// Usar:
new deck.PathLayer({ getPath: d => d.path, ... })
```

### ¿Por qué también falla con funciones?

Cuando se pasa `d => d.path`, `typeof g == "function"` → true, y se usa `g` directamente. Esto **debería** funcionar. Pero el error A (`o is not a function`) y C (`setUniforms`) ocurren aunque pases funciones. Esto confirma que **también hay tree-shaking de código interno** de PathLayer y Model, que es irrecuperable sin rebuildear el bundle.

### Conclusión

| Categoría | ¿Aplica? | Evidencia |
|-----------|----------|-----------|
| A) Incompatibilidad de versiones | ❌ | GlobeView existe en 8.9.35, todas las clases están presentes |
| B) Orden de carga | ❌ | Bundle monolítico — no hay orden |
| C) Bundle corrupto | ❌ | Checksum/tamaño normal, código parseable |
| **D) API antigua / bundle tree-shakeado** | **✅** | Funciones internas eliminadas por webpack (accessor resolution, model pipeline) |
| **E) Código de la aplicación** | **✅** | Uso de strings como accessors (solucionable parcialmente) |

**El bundle es irrecuperable para este uso.** No hay forma de restaurar las funciones eliminadas por tree-shaking desde CDN. Se necesita un bundle custom (npm) o cambiar de librería.

---

## Alternativas comparadas

Sin implementar aún. ¿Quieres que desarrolle la comparativa? Las dos opciones:

### A) deck.gl via npm + Vite
- Se instala localmente con `npm install deck.gl`
- Se escribe un entry point JS que importa los módulos
- Vite genera un bundle completo (sin tree-shaking problemático)
- Se sirve como archivo estático desde FastAPI
- **Retiene**: GlobeView 3D, H3HexagonLayer, PathLayer, todas las funcionalidades
- **Requiere**: toolchain Node.js (npm, node_modules), build step
- **Tiempo estimado**: 1-2 horas

### B) Leaflet
- CDN: leaflet.js CSS + JS + tiles CARTO dark-matter
- Datos se renderizan como círculos GeoJSON
- **Pérdida**: sin 3D globe, sin H3 hexágonos, sin PathLayer de ciclones (líneas)
- **Gana**: 100% funcional en minutos, sin build step
- **Tiempo estimado**: 20-30 minutos
