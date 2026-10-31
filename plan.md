# RISYNK — Plan técnico de implementación · Fase 1 (Foundation + Cinematic Pilot)

Estado: PLAN. No hay código implementado. Este documento define exactamente qué se construirá en la Fase 1, cómo y en qué orden. Las Fases 2–4 quedan fuera de alcance y no se ejecutarán sin autorización expresa.

---

## 0. Auditoría del repositorio (resultado)

| Elemento | Estado |
|---|---|
| Código de aplicación | Ninguno |
| Manifiesto de dependencias | Ninguno (`package.json` ausente) |
| Framework | Ninguno → se usará React + TypeScript + Vite (regla §2: repositorio vacío) |
| Archivos existentes | `.figma/README.md`, `.figma/make/site.json`, `.gitignore` (se conservan sin modificar, salvo añadir entradas a `.gitignore` si faltan `node_modules/` y `dist/`) |
| Variables de entorno requeridas | Ninguna. La Fase 1 no usa integraciones ni secretos |
| Gestor de paquetes | `npm`, como pide el brief. Se genera y versiona `package-lock.json` |

---

## 1. Stack y dependencias

### 1.1 Comandos de instalación (exactos)

```bash
npm install three gsap @fontsource-variable/inter web-vitals react react-dom
npm install -D vite typescript @vitejs/plugin-react @types/react @types/react-dom @types/three
```

- Se instala `@types/three` porque `three` no incluye tipos y el proyecto es TypeScript estricto. Su versión debe coincidir con la versión menor de `three`; se verifica tras la instalación.
- No se instalan: React Three Fiber, Lenis, librerías de scroll smoothing, librerías de postprocesamiento externas (`postprocessing`) ni librerías de animación adicionales.
- Las versiones exactas resueltas se registran en `docs/IMPLEMENTATION-LOG.md`.
- Los addons se importan desde `three/addons/...`. Ningún recurso se carga por CDN.

### 1.2 Scripts `package.json`

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b --pretty",
    "preview": "vite preview"
  }
}
```

### 1.3 Configuración

- `vite.config.ts`: `@vitejs/plugin-react`, `build.target: 'es2022'`, `build.sourcemap: true`. El puerto **no** se fija en la configuración, sino desde el script `.figma/make/dev` con `--port "$PORT"`. Si aparece un rechazo de origen del preview, se añade `server.allowedHosts` únicamente cuando `process.env.FIGMA` esté definido, derivado de `FIGMA_PUBLIC_URL`.
- `tsconfig.json` (project references) + `tsconfig.app.json` + `tsconfig.node.json`:
  - `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`.
  - `moduleResolution: "bundler"`, `jsx: "react-jsx"` y `types: ["vite/client"]`.
- `src/vite-env.d.ts`: `declare module '*.glsl?raw' { const s: string; export default s; }`. Los shaders se importan con `?raw` y se concatenan con `noise.glsl` mediante plantillas TypeScript. No se añade ningún plugin GLSL.
- `index.html`:
  - `lang="es"`, `<title>`, `meta description`, `theme-color #f2f2f4` y `color-scheme: light`.
  - Contenedor `#root`.

---

## 2. Estructura de archivos a crear

```text
index.html
package.json · package-lock.json · vite.config.ts · tsconfig*.json
src/
  vite-env.d.ts
  app/App.tsx                     composición raíz, selección WebGL vs fallback estático
  app/main.tsx                    createRoot, StrictMode, import de estilos y fuente, initWebVitals()
  content/storyContent.ts         textos EXACTOS de los 6 capítulos (fuente única de copy)
  components/Navigation/Navigation.tsx
  components/Story/Story.tsx      contenedor de scroll alto + stage sticky + creación del master timeline
  components/Story/ChapterRail.tsx  índice 01–06 funcional (botones de salto + progreso)
  components/ChapterPanel/ChapterPanel.tsx
  components/ContactCTA/ContactCTA.tsx
  components/StaticFallback/StaticFallback.tsx   SVG/HTML cuando no existe WebGL 2
  scene/SceneCanvas.tsx           monta/desmonta SceneRuntime sobre un <canvas aria-hidden>
  scene/SceneRuntime.ts           bucle de render, ciclo de vida, visibilidad, context loss
  scene/RendererFactory.ts        crea el backend; LiveSceneBackend
  scene/createScene.ts            ensambla escena lógica única
  scene/camera/CameraController.ts
  scene/camera/cameraPresets.ts
  scene/geometry/createTriangleProxy.ts
  scene/geometry/createCylinderProxy.ts
  scene/geometry/launchPath.ts    trayectoria compuesta del cilindro + LUT
  scene/materials/createTriangleMaterial.ts
  scene/materials/createCylinderMaterial.ts
  scene/materials/createParticleMaterial.ts
  scene/materials/createOrbitMaterial.ts
  scene/materials/shaderChunks.ts  chunks GLSL compartidos (perímetro, pulsos, disolución)
  scene/lighting/createEnvironment.ts
  scene/lighting/LightingController.ts
  scene/lighting/backgroundMatch.ts  solver inverso AgX para igualar #f2f2f4
  scene/energy/EnergyController.ts   motes, pulsos de perímetro, halo, luz dinámica
  scene/particles/ExhaustSystem.ts
  scene/particles/exhaustVertex.glsl
  scene/particles/exhaustFragment.glsl
  scene/particles/noise.glsl
  scene/orbits/OrbitController.ts
  scene/orbits/createOrbitGeometry.ts
  scene/animation/storyState.ts
  scene/animation/storyChapters.ts   ventanas de progreso, anclas de navegación
  scene/animation/storyTimeline.ts   master timeline único (normal + reduced motion)
  scene/animation/easing.ts          launchEase C1 y utilidades smoothstep
  scene/postprocessing/createWebGLPipeline.ts
  scene/postprocessing/BloomMixShader.ts
  scene/quality/CapabilityDetector.ts
  scene/quality/PerformanceEvaluator.ts
  scene/quality/RenderProfileManager.ts
  scene/quality/qualityProfiles.ts
  scene/assets/AssetManager.ts
  scene/assets/missingFills.ts
  scene/debug/DebugHud.tsx        solo con ?debug=1
  styles/tokens.css · global.css · story.css · responsive.css
  monitoring/webVitals.ts
docs/MISSING-FILLS.md · docs/IMPLEMENTATION-LOG.md · docs/RENDERING-ARCHITECTURE.md
.figma/make/install · .figma/make/dev · .figma/make/dev.json   (bootstrap Make)
```

Decisiones de estructura:

- No se crea `createWebGPUPipeline.ts` en Fase 1. La ruta WebGPU/TSL corresponde a la Fase 2.
- `RendererFactory` declara el tipo `backend: 'webgl2' | 'webgpu'`. En Fase 1 la rama `webgpu` no está implementada: devuelve WebGL 2, lo registra en consola y queda documentada.
- Ningún tier anuncia WebGPU como activo.

---

## 3. Design system de UI (CSS)

### 3.1 `tokens.css`

Contiene literalmente los tokens del brief y añade:

```css
--font-sans: 'PP Neue Montreal', 'Inter Variable', system-ui, sans-serif;
--weight-regular: 350; --weight-label: 400;
--text-caption:10px; --text-body:16px; --text-subheading:18px; --text-heading:27px;
--leading:1.2; --tracking:-0.02em;
--space-4:4px; --space-6:6px; --space-10:10px; --space-11:11px; --space-22:22px; --space-30:30px;
--space-34:34px; --space-35:35px; --space-50:50px; --space-69:69px; --space-94:94px; --space-113:113px;
--space-130:130px; --space-144:144px; --space-220:220px;
--content-max:1200px; --editorial-gap:94px;
--radius-nav:10px; --radius-button:26px; --radius-card:54px; --radius-body:63px; --radius-pill:9999px;
--hairline:0.5px; --hairline-strong:1px;
```

- PP Neue Montreal no se carga porque no hay archivo ni licencia. Se registra como `MISSING_FILL(PP_NEUE_MONTREAL_FONT)` y la UI renderiza con Inter Variable (`import '@fontsource-variable/inter'`).

### 3.2 Reglas globales

- Fondo `--surface-page-canvas`. Solo light mode (`color-scheme: light`).
- Prohibido: `box-shadow`, gradientes y pesos tipográficos superiores a 400.
- Títulos en Off-Black; párrafos en Steel Gray; metadatos y etiquetas de capítulo en Ash Gray.
- Signal Blue se reserva para enlaces, tags (texto + contorno hairline), contornos interactivos y `:focus-visible` (`outline: 1px solid var(--color-signal-blue); outline-offset: 4px`).
- Botón CTA: fondo Off-Black, texto Pure White, peso 400, radio 26px y padding 11/22. Nunca usa fondo azul.
- La profundidad de superficies se resuelve con Pure White sobre Off-White y bordes hairline `rgba(15,16,18,0.12)`.

### 3.3 Navegación flotante (`Navigation.tsx`)

- `position: fixed; top: 34px`, centrada y limitada a `--content-max`.
- Fondo Pure White, radio 10px, borde hairline y sin sombra.
- Contenido: wordmark `RISYNK` (`<a href="#top">`); enlaces `Ecosistema`, `Proceso`, `Capacidades`; CTA discreto `Contacto`.
- Destinos: Ecosistema → capítulo 2; Proceso → capítulo 3; Capacidades → capítulo 4; Contacto → CTA final del capítulo 6.
- Los enlaces son `<a href="#ecosistema">`, por lo que funcionan sin JS mediante anclas nativas (§5.4). Con JS se intercepta el clic y se ejecuta `window.scrollTo({ top, behavior })`, con `behavior: 'auto'` si el usuario ha activado reduced motion. No hay handler de wheel.
- `aria-current` refleja el capítulo activo.
- Móvil (< 768px): wordmark + `Contacto`; los tres enlaces quedan en una fila compacta. No se usa menú hamburguesa, para evitar un estado sin función.

---

## 4. Composición y layout

### 4.1 Estructura DOM

```html
<Navigation/>
<main id="top">
  <section class="story" style="height: var(--story-length)">   <!-- contenedor de scroll alto -->
    <span class="story-anchor" id="perspectiva|ecosistema|proceso|capacidades|sincronizacion|crecimiento" style="top:X%"/>
    <div class="stage" (position: sticky; top:0; height:100svh)>
      <div class="stage-canvas"><canvas aria-hidden="true"/></div>
      <div class="stage-info">  ChapterPanel ×6 (apilados, absolute)  + ChapterRail </div>
    </div>
  </section>
</main>
```

- Longitud de scroll: `--story-length: 1000svh` en escritorio y `900svh` en móvil. El valor se ajusta en verificación para que las pausas de lectura duren al menos unos 0,6 viewports.
- Se usa `position: sticky` y no `pin` de ScrollTrigger. Así se evitan el pin-spacer y los reflows, y el scroll sigue siendo 100 % nativo.

### 4.2 Escritorio (≥ 1024px)

- El canvas ocupa todo el stage (100vw × 100svh) para que el fondo sea continuo.
- La columna de información está a la izquierda, dentro del contenedor de 1200px, con un ancho del 38 % del contenedor y padding superior bajo la navegación.
- El encuadre 3D se desplaza a la derecha con `camera.filmOffset`, sin recortar el canvas. El centro óptico se calcula a partir del DOM: `subjectCenterX = (panelRect.right + 50px + viewportWidth) / 2`. Ese valor se convierte en offset NDC y después en `filmOffset = ndcShift * filmWidth / 2`. Se recalcula con `ResizeObserver`.
- La geometría nunca invade la columna de texto: cada preset declara un `subjectRadius` y la distancia de cámara se ajusta para que esa esfera quepa en la región derecha (§6.3).

### 4.3 Tablet (768–1023px)

- Mismo esquema que escritorio, con columna de información al 44 %.
- `subjectRadius` aumentado un 10 %.

### 4.4 Móvil (< 768px)

- `.stage-canvas` ocupa la parte superior (`height: 56svh`) y el canvas se dimensiona a esa caja. No hay segundo canvas.
- `.stage-info` ocupa el 44svh inferior sobre una superficie Pure White con radio superior de 54px y borde hairline superior. El texto siempre queda sobre superficie legible.
- `filmOffset = 0`. El encuadre usa el fit por FOV horizontal (§6.3) y presets móviles con ajustes propios de posición y target.
- Los CTAs tienen un área táctil mínima de 44px.

### 4.5 ChapterPanel

- Cada capítulo es un `<section aria-labelledby>` con:
  - etiqueta (caption 10px, peso 400, Ash Gray);
  - título (`<h1>` en el capítulo 1 y `<h2>` en el resto, 27px, peso 350, Off-Black);
  - descripción (`<p>`, 18px, Steel Gray);
  - tags (`<ul>` con pills de radio 9999px, borde hairline azul y texto azul de 10px);
  - CTA o indicador cuando proceda.
- La visibilidad se controla con `autoAlpha` desde el master timeline. Los paneles inactivos tienen `visibility: hidden`, de modo que no reciben foco ni lectura.
- Todos los textos existen en el DOM desde el primer render, lo que permite su indexación.
- `Desplázate para descubrirlo ↓` es un `<button>` que lleva al ancla del capítulo 2.

### 4.6 ChapterRail

- Seis botones (`01`…`06`) en la parte inferior de la columna, con una línea hairline de progreso (`scaleX` = progreso global, escrito por el timeline).
- Cada botón salta a la pausa de lectura de su capítulo.
- Cumple dos funciones: orienta al usuario y permite navegar con teclado. No es decorativo.

### 4.7 Contenido exacto (`storyContent.ts`)

Contiene literalmente todo el copy de §8 del brief, sin textos inventados:

- Capítulo 1: etiqueta, título, descripción e indicador.
- Capítulo 2: etiqueta, título, descripción y tags `INTEGRACIÓN`, `AUTOMATIZACIÓN`, `COHERENCIA`.
- Capítulo 3: etiqueta, título y descripción.
- Capítulo 4: etiqueta, título, descripción y microetiquetas `PRESENCE`, `MARKETING`, `CRM`, `COMMERCE`.
- Capítulo 5: etiqueta, título y descripción.
- Capítulo 6: etiqueta, título, descripción, tags `VISIBILIDAD`, `RELACIONES`, `RESULTADOS`, CTA `Hablemos de tu proyecto` y texto final `Rise. Sync. Grow.`.

### 4.8 CTA de contacto

- `ContactCTA` renderiza `<a href={CONTACT.href}>`. `CONTACT` se define en `storyContent.ts`.
- Requiere confirmación: la dirección real de contacto. Mientras no exista, el destino queda como `mailto:` con un valor documentado como `MISSING_FILL(CONTACT_ENDPOINT)`, señalado en `docs/MISSING-FILLS.md` y en el informe. No se crea ninguna sección de contacto con copy inventado.

---

## 5. Narrativa: StoryState, capítulos y master timeline

### 5.1 `storyState.ts`

Es un único objeto mutable de números planos, interpolables por GSAP sin asignaciones de objetos. Los valores derivados (vectores de cámara, posición del cilindro, etc.) los calculan los controladores en cada frame.

```ts
export interface StoryState {
  progress: number;            // 0..1, escrito por onUpdate del timeline
  chapter: number;             // 0..5, derivado de progress
  // Cámara
  cameraU: number;             // 0..7 índice continuo sobre la spline de presets
  cameraTrack: number;         // 0..1 mezcla preset ↔ seguimiento del cilindro
  cameraLift: number;          // elevación adicional (escena 5)
  dofAmount: number;           // 0..1 multiplicador de apertura del preset
  // Triángulo
  triangleReveal: number;      // 0..1 parámetro perimetral de construcción
  triangleSweep: number;       // 0..1 posición del barrido luminoso
  triangleEmission: number;    // 0..1 emisión base de los bordes
  edgeLit: [number, number, number]; // iluminación por arista (expuesto como edgeLit0/1/2)
  vertexCharge: number;        // 0..1 carga del vértice superior
  haloWave: number;            // 0..1 onda de luz del vértice superior
  gtaoBlend: number;           // 0..1 (evita artefactos durante reveal con discard)
  // Energía
  needSignal: number;          // 0..1 intensidad del pulso del vértice inferior izquierdo
  needTravel: number;          // 0..1 recorrido arista inferior → hacia el centro
  coreFlash: number;           // 0..1 expansión en el centroide
  splitTravel: number;         // 0..1 tres señales centroide → aristas → vértices
  ascent: number;              // 0..1 energía que asciende hacia el vértice superior
  returnPulse: number;         // 0..1 pulso de retorno al vértice de origen
  // Cilindro
  cylinderVisibility: number;  // 0..1 disolución + escala
  cylinderAlign: number;       // 0..1 rotación a la tangente de la trayectoria
  cylinderProgress: number;    // 0..1 parámetro de longitud de arco en launchPath
  nozzleGlow: number;          // 0..1
  // Escape
  exhaustProgress: number;     // tiempo narrativo de partículas (derivado de cylinderProgress)
  exhaustIntensity: number;    // 0..1
  // Órbitas
  orbitFormation: [number, number, number]; // draw-in por órbita (orbitFormation0/1/2)
  launchTrail: number;         // 0..1 visibilidad del tramo de lanzamiento
  orbitPhase: number;          // fase angular compartida (radianes narrativos)
  orbitSynchronization: number;// 0..1
  orbitIntensity: number;      // 0..1
  orbitConnect: number;        // 0..1 conexión visual órbitas → vértices
}
```

- En la implementación los arrays se aplanan en campos escalares (`edgeLit0`…) para que GSAP los interpole directamente.
- `createInitialStoryState()` devuelve el estado en progreso 0.

### 5.2 Tiempo narrativo

- Toda variable de posición depende solo de `progress`, vía timeline. El sistema es determinista y reversible.
- `exhaustProgress = cylinderProgress * LAUNCH_NARRATIVE_SECONDS` (≈ 6 s), en segundos narrativos. Las partículas lo reciben como `uTime`, sin usar el reloj de pared.
- Existe un `ambientClock` de reloj de pared que solo modula sombreado (parpadeo de ±8 % en el núcleo del escape y brillo de los pulsos orbitales en reposo). Nunca altera posiciones ni el estado, y queda desactivado con `prefers-reduced-motion`. Se documenta en `RENDERING-ARCHITECTURE.md`.

### 5.3 Master timeline (`storyTimeline.ts`)

- `gsap.registerPlugin(ScrollTrigger)`.
- Se crea un único `gsap.timeline` de 100 unidades (1 unidad = 1 % de progreso) con `defaults: { ease: 'none' }`.
- `ScrollTrigger`: `trigger: .story`, `start: 'top top'`, `end: 'bottom bottom'`, `scrub: 0.8` (amortiguación cinematográfica que converge a una posición determinista), `invalidateOnRefresh: true` y `onUpdate → state.progress`.
- Se crea dentro de `gsap.context(() => …, storyRootRef)` en `useLayoutEffect`. Al desmontar se ejecuta `ctx.revert()`, que elimina timeline y triggers.
- `gsap.matchMedia()` distingue entre `(prefers-reduced-motion: no-preference)` → timeline cinemático y `(prefers-reduced-motion: reduce)` → timeline discreto (§5.5). Al cambiar la preferencia, GSAP revierte un timeline y construye el otro; el progreso se recalcula desde el scroll, así que la narrativa no se reinicia.
- Los textos HTML se animan en ese mismo timeline (`autoAlpha`, `y: 12 → 0`). No hay triggers independientes por sección.
- Para mantener el sistema determinista, ninguna propiedad recibe dos tweens solapados: cada propiedad usa tweens secuenciales con posiciones absolutas. Se valida en desarrollo con un helper `assertNoOverlap` que recorre `tl.getChildren()`.
- Eases permitidos: `power1/2/3.inOut|in|out`, `sine.inOut` y `launchEase` (propio). Prohibidos: `elastic`, `bounce` y `back`.
- Las pausas son intervalos sin tweens en movimiento. No se usa `addPause()`.

#### Tabla de keyframes (progreso en %)

| % | Pista | Valor / evento | Ease |
|---|---|---|---|
| **0–14** | **Cap. 1 Perspectiva limitada** | | |
| 0 | estado | cameraU 0 (CAM_01), triangleReveal 0.334 (arista inferior completa), triangleEmission 0, dofAmount 1, cylinderVisibility 0, gtaoBlend 1 | — |
| 0–12 | texto cap. 1 | visible (entrada de carga, §5.6) | — |
| 0–11 | — | **pausa de lectura** | — |
| 11–14 | cameraU | 0 → 0.15 (inicio sutil del dolly) | power1.in |
| 12–14 | texto cap. 1 | autoAlpha 1 → 0, y 0 → -8 | power1.in |
| **14–29** | **Cap. 2 Revelación** | | |
| 14–25 | cameraU | 0.15 → 1 (CAM_02, dolly out) | power2.inOut |
| 14–17 | gtaoBlend | 1 → 0 (antes de abrir el corte) | power1.out |
| 14.5–16.5 | texto cap. 2 | entrada | power2.out |
| 15–19 | triangleReveal | 0.334 → 0.667 (segunda arista) | power2.inOut |
| 19–23 | triangleReveal | 0.667 → 1 (tercera arista) | power2.inOut |
| 16–18.5 | tags cap. 2 | stagger 0.6 | power2.out |
| 22–26 | triangleSweep | 0 → 1 (barrido cian por las tres aristas) | sine.inOut |
| 22–26 | triangleEmission | 0 → 0.35 | power1.inOut |
| 23–25 | gtaoBlend | 0 → 1 | power1.inOut |
| 23–25 | dofAmount | 1 → 0.15 | power1.inOut |
| 25–27.5 | — | **pausa de lectura** | — |
| 27.5–29 | texto cap. 2 | salida | power1.in |
| **29–42** | **Cap. 3 Necesidad** | | |
| 29–34 | cameraU | 1 → 2 (CAM_03, vértice inferior izquierdo) | power2.inOut |
| 29–34 | dofAmount | 0.15 → 0.8 | power1.inOut |
| 29.5–31.5 | texto cap. 3 | entrada | power2.out |
| 31–33 | needSignal | 0 → 1 (azul tenue → intenso; incluye expansión ligera) | power2.out |
| 33–38 | needTravel | 0 → 0.75 (mote recorre la arista inferior hasta su punto medio; la arista se enciende tras él vía edgeLit0) | sine.inOut |
| 33–38 | edgeLit0 | 0 → 1 | power1.inOut |
| 34–38 | cameraU | 2 → 2.35 (la cámara sigue parcialmente) | sine.inOut |
| 38–39.5 | needTravel | 0.75 → 1 (el mote abandona la arista hacia el centroide y se detiene antes de alcanzarlo) | power2.out |
| 39.5–41 | — | **pausa de lectura** | — |
| 41–42 | texto cap. 3 | salida | power1.in |
| **42–58** | **Cap. 4 Transformación** | | |
| 42–47 | cameraU | 2.35 → 3 (CAM_04, centro) | power2.inOut |
| 42–47 | dofAmount | 0.8 → 0.4 | power1.inOut |
| 42.5–44.5 | texto cap. 4 | entrada | power2.out |
| 43–45 | needTravel | 1 → 1.15 (llega al núcleo; el tramo 1–1.15 es el tramo final hasta el centroide) | power2.inOut |
| 45–46.5 | coreFlash | 0 → 1 → 0.2 (expansión controlada) | power2.out |
| 46.5–54 | splitTravel | 0 → 1: tres motes centroide → punto medio de cada arista (0–0.25), después recorren cada arista hasta su vértice (0.25–1) | sine.inOut |
| 48–54 | edgeLit0/1/2 | → 1 progresivo, ligado a la proximidad del mote | power1.inOut |
| 49–53 | microtags cap. 4 | stagger | power2.out |
| 53.5–55 | triangleEmission | 0.35 → 0.6 (estado uniforme y sincronizado) | power1.inOut |
| 55–56.8 | — | **pausa de lectura** | — |
| 56.8–58 | texto cap. 4 | salida | power1.in |
| **58–73** | **Cap. 5 Activación** | | |
| 58–63 | cameraU | 3 → 4 (CAM_05, vértice superior) | power2.inOut |
| 58.5–60.5 | texto cap. 5 | entrada | power2.out |
| 59–63 | ascent | 0 → 1 (energía asciende por las dos aristas laterales) | power2.in |
| 63–65 | vertexCharge | 0 → 1 | power2.in |
| 63–68 | cameraLift | 0 → 1 (pequeña elevación) | sine.inOut |
| 65–66.5 | haloWave | 0 → 1 | power2.out |
| 66–68.5 | cylinderVisibility | 0 → 1 (escala 0.6 → 1 + disolución con borde cian) | power2.out |
| 68–70.5 | cylinderAlign | 0 → 1 (de la tangente de la arista derecha a la tangente de lanzamiento) | power2.inOut |
| 69.5–71 | nozzleGlow | 0 → 1 | power2.in |
| 71–72 | vertexCharge | 1 → 1.25 (instante de máxima energía) | power1.in |
| 70.5–72 | — | **pausa** previa al lanzamiento | — |
| 72–73 | texto cap. 5 | salida | power1.in |
| **73–100** | **Cap. 6 Crecimiento** | | |
| 73–80 | cylinderProgress | 0 → 0.30 (tramo A: lanzamiento) | launchEase segmento 1 |
| 73–75 | cameraTrack | 0 → 1 (CAM_06, seguimiento) | power2.inOut |
| 73–74 | exhaustIntensity | 0 → 1 | power2.out |
| 73–75 | vertexCharge, haloWave | → 0.3, → 0 | power1.out |
| 73–76 | dofAmount | → 0 (sin DoF en movimiento rápido) | power1.out |
| 73–80 | launchTrail | 0 → 1 (el tubo del tramo de lanzamiento se dibuja tras el cilindro) | ligado a cylinderProgress |
| 74–76 | texto cap. 6 | entrada (etiqueta, título, descripción) | power2.out |
| 80–88 | cylinderProgress | 0.30 → 0.86 (tramo B: arco sobre la órbita 1) | launchEase segmento 2 |
| 80–88 | orbitFormation0 | ligado al avance del cilindro (la estela se convierte en la órbita 1) | none |
| 80–88 | cameraU | 4 → 6 (pasa por CAM_06 → CAM_07; travelling lateral) | power2.inOut |
| 81–86 | cameraTrack | 1 → 0 | power2.inOut |
| 82–87 | orbitFormation1 | 0 → 1 (nace en la intersección con la órbita 1 y crece en ambas direcciones) | power2.inOut |
| 84–89 | orbitFormation2 | 0 → 1 (mismo método) | power2.inOut |
| 82/84/86 | tags cap. 6 | VISIBILIDAD, RELACIONES y RESULTADOS, sincronizados con su órbita | power2.out |
| 86–92 | launchTrail | 1 → 0 (se disuelve desde el vértice hacia la órbita) | power1.inOut |
| 88–90 | cylinderProgress | 0.86 → 1 (tramo C: escape fuera de encuadre) | launchEase segmento 3 |
| 89–90 | cylinderVisibility, exhaustIntensity | → 0 (ya fuera de encuadre) | power1.in |
| 86–95 | orbitPhase | 0 → Φ (giro coordinado y desacelerado) | power2.out |
| 90–95 | orbitSynchronization | 0 → 1 (los pulsos alinean su fase) | power2.inOut |
| 93–96 | triangleEmission | 0.6 → 0.85; orbitConnect 0 → 1 | power1.inOut |
| 95–97.5 | returnPulse | 0 → 1 (pulso perimetral hasta el vértice inferior izquierdo de origen) | sine.inOut |
| 94–99 | cameraU | 6 → 7 (CAM_08, final lock) | power2.inOut |
| 95–97 | CTA y "Rise. Sync. Grow." | entrada | power2.out |
| 97.5–100 | — | **encuadre estable final** | — |

- `chapter` se deriva de las ventanas `[0,14,29,42,58,73,100]` definidas en `storyChapters.ts`. Esa misma tabla alimenta `ChapterRail`, la navegación y las anclas.
- Las animaciones `orbitFormation0` y `launchTrail` no se tweenean por separado: `OrbitController` las deriva de `cylinderProgress` dentro de su ventana, para garantizar que la estela coincida exactamente con la cabeza del cilindro.

### 5.4 Anclas y salto a capítulos

- `storyChapters.ts` define `readingAnchor` como el punto medio de la pausa de lectura de cada capítulo: 6, 26, 40, 56, 71 y 98.
- Los `<span class="story-anchor">` se posicionan con `top: calc(anchor% * (story-length - 100svh) / story-length)` mediante una custom property, de modo que el ancla nativa (sin JS) cae en la pausa correcta.
- Con JS, el salto usa `st.start + anchor * (st.end - st.start)`.

### 5.5 Timeline de `prefers-reduced-motion: reduce`

- Usa las mismas ventanas de capítulo. Cada capítulo tiene un **estado clave estático**: preset de cámara final del capítulo, valores de emisión y visibilidad del final de su ventana, cilindro sin desplazamiento continuo y órbitas formadas sin rotación en el capítulo 6.
- En cada frontera se aplican las transiciones discretas:
  1. `.stage-canvas` hace un fundido opacity 1 → 0 durante 0.6 unidades;
  2. se ejecuta `tl.set` del nuevo estado;
  3. `.stage-canvas` vuelve a opacity 1 durante 0.6 unidades.
- Los textos usan solo `autoAlpha`, sin `y`.
- Partículas: `uTurbulence = 0`, intensidad reducida y emisor estático en el capítulo 6, con el cilindro mostrado en pose de lanzamiento. Las órbitas aparecen formadas y el cilindro no recorre la trayectoria.
- Se desactivan `ambientClock`, `scrub` (se usa `scrub: true`) y la entrada de carga con desplazamiento.

### 5.6 Entrada de carga (Escena 01)

- Es una animación única basada en tiempo, de 1,6 s y separada del timeline de scroll. Solo afecta a dos canales aditivos que vuelven a 0, por lo que no entra en conflicto con el estado:
  - `intro.cameraDolly` (offset de 0.25 unidades hacia el objeto, aplicado en `CameraController`);
  - la opacidad/y de los textos del capítulo 1, mediante `gsap.from` con `clearProps` al finalizar.
- Si el usuario hace scroll antes de que termine, la entrada se completa de inmediato con `progress(1)`.

---

## 6. Cámara

### 6.1 Configuración

- `PerspectiveCamera(fov 34, aspect, near 0.1, far 100)`, `filmGauge 35`.
- Sistema de coordenadas: Y arriba. El centroide del triángulo está en el origen.

### 6.2 `cameraPresets.ts`

```ts
interface CameraPreset {
  id: 'CAM_01_HERO_CLOSE' | ... | 'CAM_08_FINAL_LOCK';
  position: Vec3; target: Vec3; fov: number;
  focusDistance: number | 'auto';   // auto = |position - target|
  aperture: number;                 // escala de BokehPass (0 = nítido)
  roll: number;                     // radianes
  subjectRadius: number;            // esfera que debe caber en la región de encuadre
  framing: { x: number; y: number };// desplazamiento del sujeto relativo a la región (-0.5..0.5)
  mobile?: Partial<Omit<CameraPreset,'id'|'mobile'>>;
}
```

Valores iniciales (se ajustan visualmente durante la verificación y el ajuste final se documenta):

| Preset | position | target | fov | aperture | roll | subjectRadius |
|---|---|---|---|---|---|---|
| CAM_01_HERO_CLOSE | (1.25, -0.35, 1.55) | (0.55, -0.62, 0) | 34 | 1.0 | -0.04 | 0.55 |
| CAM_02_TRIANGLE_REVEAL | (3.2, 1.6, 7.4) | (0, 0, 0) | 34 | 0.1 | 0 | 1.75 |
| CAM_03_NEED_FOCUS | (-2.6, -0.2, 3.2) | (-1.0, -0.55, 0) | 34 | 0.8 | 0.02 | 1.0 |
| CAM_04_TRANSFORMATION_FOCUS | (1.0, 0.45, 3.9) | (0, 0, 0) | 36 | 0.4 | 0 | 1.5 |
| CAM_05_ACTIVATION_FOCUS | (0.9, 2.2, 3.4) | (0, 1.3, 0) | 35 | 0.6 | -0.02 | 0.9 |
| CAM_06_ROCKET_TRACK | (2.2, 2.4, 6.0) | dinámico | 36 | 0 | 0 | 1.2 |
| CAM_07_ORBIT_OVERVIEW | (5.5, 3.4, 9.8) | (0, 0.2, 0) | 36 | 0.05 | 0 | 3.4 |
| CAM_08_FINAL_LOCK | (4.6, 2.6, 10.6) | (0, 0.1, 0) | 35 | 0.05 | 0 | 3.5 |

### 6.3 `CameraController.ts`

- Las posiciones y targets de los presets se interpolan con `CatmullRomCurve3` en modo `centripetal` (tensión 0.5). Se construye una curva para posición y otra para target, y se evalúan en `cameraU / 7`, con reparametrización por segmento para que cada `cameraU` entero coincida exactamente con su preset. El resultado tiene continuidad C1: no hay saltos ni esquinas.
- `fov`, `aperture`, `roll` y `focus` se interpolan con smoothstep por segmento.
- **Encuadre responsive**: la dirección del preset es `normalize(position - target)`. La distancia se calcula como `max(d_preset, subjectRadius / sin(min(vFov, hFov_region) / 2))`, donde `hFov_region` usa el ancho de la región de encuadre (columna derecha en escritorio y canvas completo en móvil). En móvil se aplica primero el override `mobile`. Así se evita el clipping en cualquier aspecto.
- **Seguimiento (CAM_06)**:
  - `trackTarget = lerp(presetTarget, cylinderPos(s - 0.04), cameraTrack)`, con el target ligeramente retrasado respecto a la cabeza del cilindro y evaluado de forma determinista sobre la LUT.
  - `trackPos = trackTarget + offset`, con un offset lateral que gira suavemente para producir el travelling.
- `cameraLift` añade una elevación en Y de hasta +0.35 y `intro.cameraDolly` desplaza la cámara a lo largo de la dirección de vista.
- `roll` se aplica rotando `camera.up` alrededor del eje de vista antes de `lookAt`.
- `focusDistance` se envía a `BokehPass` como `focus`. Durante el tracking el foco es la distancia al cilindro; en el resto de presets, la distancia al target.
- `camera.filmOffset` se calcula según §4.2 y después se ejecuta `updateProjectionMatrix()`.

---

## 7. Geometría provisional

### 7.1 `createTriangleProxy.ts`

**Geometría**

- Triángulo equilátero de lado `s = 2.4`, circunradio `R = s/√3 ≈ 1.386`.
- Vértices en el plano XY: `top (0, R)`, `BL (-s/2, -R/2)` y `BR (s/2, -R/2)`.
- `Shape` exterior: triángulo con esquinas redondeadas de radio 0.07 mediante `absarc`/`quadraticCurveTo` en cada vértice.
- `Path` interior (hole): triángulo offset hacia dentro con un ancho de marco `w = 0.30`. Su inradio es el del exterior menos `w`, y sus esquinas tienen radio 0.035.
- `ExtrudeGeometry` con `depth: 0.30`, `bevelEnabled: true`, `bevelThickness: 0.035`, `bevelSize: 0.03`, `bevelOffset: 0`, `bevelSegments: 5` (tier 0–1: 3), `curveSegments: 12` y `steps: 1`.
- Después se centra en Z (`translate(0, 0, -depth/2)`), se ejecutan `computeVertexNormals()` y `computeBoundingSphere()`, y se comprueba que no hay normales NaN.
- Las tres aristas pertenecen a una sola forma continua, sin uniones visibles.

**Orientación ligeramente isométrica**

- Se aplica al grupo, no a la geometría: `rotation.set(-0.12, -0.32, 0)`, que inclina el objeto para mostrar el grosor y los biseles.
- El grupo flota a `y = 0`.
- `TriangleProxy` expone en object space los vértices, los puntos medios, el centroide y la función `perimeterPoint(t)` para que `EnergyController` coloque motes y luces en coordenadas exactas.

**Shadow catcher**

- `PlaneGeometry(14,14)` en `y = -1.45` con `ShadowMaterial` de color `#8A86A3` y opacidad 0.16.
- `receiveShadow = true`, `renderOrder = -1`.
- Es invisible salvo por la sombra de contacto y no es un objeto narrativo nuevo.
- En tier 0 se sustituye por un plano con textura de sombra procedural (`DataTexture` radial generada en código, sin assets externos) y la proyección se hace mediante blob.

**Integración del modelo definitivo**

- `// TODO: MISSING_FILL(PENROSE_FINAL_GLB) — AssetManager.load('penrose') sustituirá a createTriangleProxy() manteniendo: grupo raíz 'TriangleRoot', centroide en origen, circunradio 1.386, vértices nombrados V_TOP/V_BL/V_BR y API perimeterPoint(t)`.

### 7.2 `createCylinderProxy.ts`

- `CylinderGeometry(radiusTop 0.13, radiusBottom 0.13, height 0.9, radialSegments 96, heightSegments 24, openEnded false)`. En tier 0 se usan 48 segmentos radiales.
- El origen del grupo está en el centro del cilindro, con el eje +Y local como dirección de avance. La tobera está en `y = -0.45` local (punto de emisión, nodo `Nozzle`).
- Se aplican `castShadow` y `receiveShadow`.
- No se añaden alas, ventanas ni piezas adicionales.
- `// TODO: MISSING_FILL(ROCKET_FINAL_GLB)`: debe conservar eje +Y, longitud normalizada 0.9 y un nodo `Nozzle`.

### 7.3 `launchPath.ts`

Clase `LaunchPath extends Curve<Vector3>` compuesta y parametrizada por longitud de arco (`getPointAt` / `getTangentAt`, `arcLengthDivisions = 2000`):

1. **Tramo A (lanzamiento)**: Bézier cúbica desde `V_TOP_world + up * 0.55` (posición del cilindro materializado), con tangente inicial `+Y` ligeramente inclinada a la derecha, hasta el punto de entrada `E` de la órbita 1. Su tangente final es la tangente de la órbita 1 en `E`, lo que garantiza la continuidad C1. La trayectoria va hacia arriba y a la derecha.
2. **Tramo B (órbita)**: arco exacto de la elipse de la órbita 1 entre `θE` y `θE + 0.62·2π`.
3. **Tramo C (escape)**: Bézier cúbica tangente a la órbita en la salida. Termina fuera del frustum de CAM_07, arriba y a la derecha.

Además:

- Las fracciones de longitud de cada tramo se calculan y exportan (≈ 0.30 / 0.56 / 0.14). Por eso la timeline usa 0.30 y 0.86.
- Los frames de orientación se precalculan en 512 muestras con transporte paralelo (`computeFrenetFrames` para evitar giros bruscos de `roll`).
- `baked LUT`: `DataTexture` de 512×2 `RGBAFloat` (fila 0: posición; fila 1: tangente) con `NearestFilter` e interpolación manual en el shader. El JS usa la misma tabla con la misma interpolación lineal, así que el emisor de partículas y el cilindro coinciden exactamente.
- `launchEase(t)` está en `easing.ts`: es una función de velocidad C1 continua y monótona por tramos, compuesta por aceleración cuadrática, crucero lineal y desaceleración. Se aplica a cada segmento con velocidades de enlace iguales, de modo que la velocidad aumenta al principio, alcanza un desplazamiento más rápido y después se estabiliza.

**Orientación del cilindro**

- `qPath = quaternion(frame.tangent, frame.normal)`.
- `qStart` alinea el cilindro con la tangente de la arista derecha en el vértice superior.
- Resultado: `slerp(qStart, qPath(0), cylinderAlign)` hasta el lanzamiento y `qPath(s)` después.

---

## 8. Materiales

### 8.1 Gestión de color (global)

- `THREE.ColorManagement.enabled = true` (working space lineal sRGB).
- `renderer.outputColorSpace = SRGBColorSpace`.
- `renderer.toneMapping = AgXToneMapping`, aplicado una sola vez por `OutputPass`. El `RenderPass` trabaja en HDR lineal (`HalfFloatType`), y la conversión a sRGB solo ocurre en `OutputPass`, sin duplicados.
- `toneMappingExposure = 1.0` como base calibrada (§9.5).
- Los colores de la paleta 3D se definen con `new Color('#EAEAF1')` (conversión automática sRGB → lineal).
- Futuras texturas de color con `colorSpace = SRGBColorSpace`; mapas técnicos y normales con `NoColorSpace`; HDR en lineal.

### 8.2 Triángulo: `createTriangleMaterial.ts`

`MeshPhysicalMaterial`:

- `color #EAEAF1`, `roughness 0.42`, `metalness 0`;
- `clearcoat 0.35`, `clearcoatRoughness 0.18`;
- `specularIntensity 0.6`, `specularColor #BCEEFF` (reflejos azul hielo en biseles);
- `envMapIntensity 1.0` y `side: DoubleSide` (necesario para la tapa del corte).

Extensión vía `onBeforeCompile`, solo WebGL. El equivalente TSL queda para la Fase 2 y se documenta.

**Varyings**

- `vLocalPos` (object space) y `vLocalNormal`.

**Coordenadas analíticas en fragment** (sin atributos, independientes de la densidad de malla):

- Para cada una de las 3 aristas de la línea media del marco (offset `w/2` del contorno exterior), se calcula la proyección del punto sobre el segmento y se elige la arista más cercana.
- `t = (edgeIndex + proj) / 3`, con orden de perímetro `BL→BR` (arista 0), `BR→TOP` (arista 1) y `TOP→BL` (arista 2).
- `across`: distancia firmada a la línea media, normalizada a `[-1, 1]` sobre `w`.
- `front`: `smoothstep` sobre `vLocalPos.z` respecto de la cara frontal.

**Uniforms**

- `uReveal`, `uSweep`, `uEmission`;
- `uEdgeLit` (vec3) y `uPulses[6]` (vec4: t, ancho, intensidad, activo);
- `uVertexCharge`, `uHalo`, `uCyan`, `uAmbient`;
- `uMicroVar`: ruido de valor 3D barato que varía la rugosidad ±0.04, para evitar una apariencia CG plana.

**Reveal**

- `if (t > uReveal) discard;`
- Se añade una banda emisiva en `[uReveal - 0.012, uReveal]` como frente luminoso de construcción.
- Las caras traseras visibles a través del corte (`!gl_FrontFacing`) se sombrean como tapa emisiva cian tenue, de modo que el corte se lee como una sección luminosa y no como un hueco.

**Líneas emisivas**

- Inlay sobre el contorno interior de la cara frontal y del bisel: `mask = (1 - smoothstep(lw - fw, lw + fw, abs(across - 0.82))) * front`, con `fwidth` para antialiasing.
- Donde `mask > 0`, el albedo se oscurece hacia `#0B2A33` (×0.85). Esto es imprescindible: sobre perla en un estudio high-key, la emisión aditiva saturaría a blanco. La emisión resultante es `cyan * I`, con `I ≤ 2.2` para que AgX no desature el tono hacia blanco.

**Emisión total por fragmento**

```text
I = uEmission * mask
  + Σ pulses gauss(dist_perim(t, p.t), p.w) * p.i * (mask + 0.25 * front)
  + uEdgeLit[edge] * mask * 0.8
  + sweepBand(t, uSweep) * mask
  + uVertexCharge * vertexProximity(TOP)
```

- `dist_perim` usa distancia circular, con wrap en 0/1.
- Rebote luminoso sobre el material: un término `0.15 * pulseGlow` en zonas no inlay simula la luz del pulso sobre la superficie cercana, además de la `PointLight` dinámica real (§9.3).
- `customDepthMaterial` (`MeshDepthMaterial` + mismo `discard` por `onBeforeCompile`), para que la sombra respete el reveal.
- **Material emissive-only** (`userData.bloomMaterial`): `ShaderMaterial` con la misma lógica de `t`/máscara. Emite `cyan * I` y el resto en negro opaco, de modo que actúa como oclusor en la pasada de bloom (§10.2).

### 8.3 Cilindro: `createCylinderMaterial.ts`

`MeshPhysicalMaterial`:

- `color #F6F6FA`, `roughness 0.28`, `metalness 0`;
- `clearcoat 0.6`, `clearcoatRoughness 0.12`;
- `specularColor #BCEEFF`, `specularIntensity 0.7`.

`onBeforeCompile`:

- **Rugosidad variable**: bandas sutiles a lo largo de la altura local (`roughness ± 0.06`) y ruido fino.
- **Detalle luminoso mínimo**: un anillo emisivo fino en `y_local ∈ [-0.40, -0.38]` y una emisión de tobera en la tapa inferior (normal local `-Y`), escaladas por `uNozzleGlow` con un perfil más intenso en la base.
- **Materialización (`uDissolve`)**: ruido 3D con umbral. Fragmentos con `noise < 1 - uDissolve` → `discard`; la franja de borde es emisiva cian. A la vez, la escala del grupo pasa de 0.6 a 1. `opacity` no se usa para evitar problemas de orden de transparencia.
- Incluye también `customDepthMaterial` y una versión `bloomMaterial` (solo anillo y tobera emisivos; el resto negro).

### 8.4 Órbitas y tubo de lanzamiento: `createOrbitMaterial.ts`

`ShaderMaterial` (`transparent: true`, `depthWrite: true`, `depthTest: true`).

- **Atributos**: `uv.x` como parámetro de la curva (0..1) y `uv.y` como ángulo radial del tubo.
- **Uniforms**:
  - `uDrawStart` / `uDrawEnd` (rango dibujado, en coordenada circular) y `uHeadSoftness`;
  - `uIntensity`, `uColor`;
  - `uPulsePhase`, `uPulseCount` (3) y `uSync`;
  - `uConnect`, `uAmbient`.
- **Color**:
  - núcleo cian con `fresnel` para dar volumen al tubo fino: `mix(uColor * 1.6, iceBlue, fresnel)`;
  - pulsos gaussianos circulando a `uPulsePhase`;
  - fade suave en los extremos del rango dibujado (cabeza más brillante: `head boost`).
- Se renderiza en HDR con intensidad ≤ 2.0 y su versión de bloom es el propio material (`layers` de bloom).

### 8.5 Partículas: `createParticleMaterial.ts`

Ver §11.

- **Prohibido**: `MeshBasicMaterial` como material general. Solo se permite internamente en las variantes negras de oclusión de la pasada de bloom.

---

## 9. Iluminación y entorno

### 9.1 `createEnvironment.ts`

- `RoomEnvironment` + `PMREMGenerator.fromScene(room, 0.04)`.
- `scene.environment = envRT.texture`, con `scene.environmentIntensity = 0.85`.
- El entorno no se usa como fondo.
- `// TODO: MISSING_FILL(BRANDED_HDRI) / MISSING_FILL(PRODUCTION_HDRI)`: `AssetManager.load('hdri')` → `RGBELoader`/`EXRLoader` → `pmrem.fromEquirectangular`, sustituyendo `envRT` sin tocar materiales.
- El PMREM se libera en `dispose()`.

### 9.2 `backgroundMatch.ts`

- **Problema**: el fondo pasa por AgX en `OutputPass` y no coincidiría con `#f2f2f4`.
- **Solución**:
  - Se porta a JS la función AgX de `three/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js` (matrices de entrada/salida, contraste polinómico y conversión sRGB).
  - Se resuelve el color lineal de fondo con iteración de Newton multivariante, con tolerancia `1/1024` por canal y la exposición actual.
  - El resultado se asigna a `scene.background`.
- Se valida en desarrollo leyendo un píxel de esquina con `readRenderTargetPixels` sobre la salida final (`?debug=1`). Objetivo: `ΔE < 1` respecto a la página.
- Se recalcula si cambia la exposición.

### 9.3 `LightingController.ts` (presupuesto fijo: 4 luces)

| Luz | Tipo | Color | Intensidad | Posición | Sombras |
|---|---|---|---|---|---|
| Key | DirectionalLight | #FFFFFF | 2.2 | (4, 6, 5) | sí (tier ≥ 1): mapSize 1024/2048/2048, bias -0.0002, normalBias 0.02, frustum ajustado a radio 4 |
| Fill | HemisphereLight | sky #E3DDF3 / ground #C8C5D8 | 0.55 | — | no |
| Rim | DirectionalLight | #BCEEFF | 1.2 | (-5, 3, -4) | no |
| Energy | PointLight | #58DDFB | 0 → 6 (tweened) | dinámica | no |

- **Posición de la luz Energy**: interpolación ponderada y continua entre anclas (mote de necesidad, centroide, vértice superior, tobera y órbitas), con pesos derivados de `StoryState`. Así nunca salta. `distance = 2.5` y `decay = 2`.
- **Tipo de sombra**: `PCFShadowMap` con `shadow.radius` para suavizar. Se confirma contra la API de la versión instalada de three; si `PCFSoftShadowMap` está deprecado, no se usa.
- **Proyectores de sombra**: triángulo y cilindro. Las partículas y órbitas no proyectan sombra.
- **Sin luces por partícula.**

### 9.4 Lightmaps / AO horneado (arquitectura preparada)

- `MaterialController.applyBakedLighting({ lightMap, aoMap, intensity })` asignará `lightMap`/`aoMap` (canal uv1) cuando existan.
- Al activarse, se reduce `environmentIntensity` y la intensidad de la HemisphereLight según `bakedContribution`, para no duplicar la luz indirecta. La regla queda documentada en código y en `RENDERING-ARCHITECTURE.md`.
- `// TODO: MISSING_FILL(BAKED_LIGHTMAP_ATLAS)` y `// TODO: MISSING_FILL(BAKED_AO_ATLAS)`.

### 9.5 Calibración de exposición

- Objetivo: el pico especular perla queda por debajo de clipping y el cian sigue siendo cian.
- Se ajusta `toneMappingExposure` y la intensidad de la luz Key. Después se recalcula `backgroundMatch`.
- Los valores finales se registran en el log.

---

## 10. Postprocesamiento WebGL 2: `createWebGLPipeline.ts`

### 10.1 Orden de pasadas (composer final)

```text
EffectComposer(renderTarget HalfFloat, samples = qc.msaa)
 1. RenderPass(scene, camera)                  HDR lineal
 2. GTAOPass (qc.gtao.enabled)                 blendIntensity = qc.gtao.intensity * state.gtaoBlend
 3. SSRPass  (qc.ssr.enabled, selects=[triangleMesh, cylinderMesh])   solo tier 3
 4. ShaderPass(BloomMixShader)                 composición de la textura de bloom
 5. BokehPass (qc.dof.enabled)                 focus/aperture/maxblur por frame
 6. OutputPass                                 AgX + sRGB (única transformación)
 7. SMAAPass  (qc.smaa)                        AA en espacio de salida
```

- **SSRPass**: renderiza la escena él mismo. Cuando está activo, sustituye a `RenderPass` en la posición 1 (no se apilan), con `selects` para limitar las regiones a superficies del triángulo y el cilindro. En Fase 1 solo se habilita en tier 3 y se puede desactivar con `?ssr=0`.
- **GTAOPass**: se configura con `radius 0.35`, `distanceExponent 1.5`, `thickness 1`, `scale 1` y `samples` según el tier. Durante el reveal (`gtaoBlend = 0`) se desactiva por completo (`enabled = false` si el valor es menor de 0.001), porque su pasada de normales y profundidad no respeta el `discard`. Esta decisión queda documentada.
- **BokehPass**: `focus = CameraController.focusDistance` y `aperture = preset.aperture * state.dofAmount * qc.dof.apertureScale`. Se desactiva si `aperture * maxblur < ε`, lo que lo apaga por completo en movimiento rápido. No afecta al HTML porque solo procesa el canvas.

### 10.2 Bloom selectivo (obligatorio): pasada de máscara emisiva separada

- `bloomComposer` (`renderToScreen: false`) a `qc.bloom.resolutionScale` (0.5 por defecto):
  1. `RenderPass` con override por objeto: antes de renderizar, `BloomMaskController.swapIn()` asigna a cada mesh su `userData.bloomMaterial` (versiones emissive-only y negras que actúan como oclusores, con el mismo `discard`). Además pone `scene.background = black` y oculta el shadow catcher y el vapor. Las partículas de núcleo y sparks, las órbitas y los motes se renderizan con su propio material.
  2. `UnrealBloomPass(strength qc.bloom.strength, radius qc.bloom.radius, threshold 0)`. El umbral es 0 porque la máscara ya es selectiva.
  3. `swapOut()` restaura materiales, fondo y visibilidad. Se usa un `Map` cacheado, sin asignaciones por frame.
- **`BloomMixShader`** (composición para fondo claro):
  ```glsl
  vec3 b = texture2D(tBloom, vUv).rgb;
  float m = max(max(b.r,b.g),b.b);
  float a = clamp(m * uAlphaGain, 0.0, 1.0);
  vec3 tint = b / max(m, 1e-4);
  vec3 c = base.rgb;
  c = mix(c, c * mix(vec3(1.0), tint, uTintStrength), a);  // resta rojo: el halo se lee cian sobre blanco
  c += b * uAdd;
  ```
  El bloom puramente aditivo sobre un estudio high-key satura hacia blanco y el halo desaparece. Este mix tiñe el halo de cian de forma localizada y evita la "mancha blanca". Los parámetros se ajustan visualmente.

### 10.3 Ciclo de vida

- `setSize(w, h, pixelRatio)` reajusta ambos composers y cada pasada.
- `rebuild(qualityConfig)` recrea solo las pasadas afectadas.
- `dispose()` libera composers, render targets y materiales de pasada.

---

## 11. Sistema de partículas del escape: `ExhaustSystem.ts`

### 11.1 Arquitectura

Hay tres `THREE.Points` independientes con `ShaderMaterial` y vértices y fragmentos compartidos, diferenciados por `#define LAYER_CORE | LAYER_VAPOR | LAYER_SPARKS`.

| Capa | Tier 0 | Tier 1 | Tier 2 | Tier 3 | Blending | depthWrite | Bloom |
|---|---|---|---|---|---|---|---|
| Core | 1 500 | 3 000 | 6 000 | 10 000 | Additive | false | sí |
| Vapor | 3 000 | 6 000 | 12 000 | 20 000 | Normal premultiplied (`premultipliedAlpha: true`, `CustomBlending One / OneMinusSrcAlpha`) | false | no |
| Sparks | 300 | 600 | 1 200 | 2 000 | Normal premultiplied | false | sí |

- En móvil se aplica un multiplicador de ×0.5.
- **Desviación documentada**: el brief indica blending aditivo para núcleo y sparks. Se mantiene en el núcleo (debe leerse blanco-cian incandescente). En los sparks se usa "over" premultiplicado más bloom selectivo, porque en un estudio blanco el aditivo los volvería blancos e invisibles. El vapor usa lavanda y gris frío (`#C8C5D8` → `#E3DDF3`) con alfa bajo para leerse como volumen sobre `#f2f2f4`.

### 11.2 Atributos (por partícula, generados con PRNG determinista mulberry32 con semilla fija)

- `aSeed` (0..1): fase de emisión y variación.
- `aAge` (0..1): offset inicial de fase dentro del ciclo de vida.
- `aLifetime`, en segundos narrativos: core 0.35–0.6; vapor 1.2–2.8 (cola larga que deja rastro); sparks 0.4–1.0.
- `aSize`: distribución sesgada (`pow(rand, 2.2)`) para mezclar muchos pequeños y pocos grandes.
- `aVelocity`: velocidad escalar inicial (core 2.4–3.2; vapor 0.8–1.6; sparks 1.5–3.5).
- `aSpread` (vec2): ángulos del cono (θ dentro del semiángulo de la capa: core 4°, vapor 16°, sparks 28°) y φ azimutal.
- `aNoiseOffset` (vec3).

### 11.3 Uniforms

- Del brief: `uTimelineProgress`, `uLaunchProgress`, `uTime` (segundos narrativos = `exhaustProgress`), `uParticleIntensity`, `uParticleCount`, `uNoiseScale`, `uTurbulence`, `uPixelRatio`.
- Adicionales:
  - `uPathLUT` (sampler2D) y `uLaunchDuration`;
  - `uNozzleOffset` y `uEmitWindow` (vec2);
  - `uMaxPointSize`, `uViewportHeight`, `uAmbient`, `uColorA`/`uColorB`.

### 11.4 Vertex shader (`exhaustVertex.glsl`, sin estado)

```glsl
float life  = aLifetime;
float phase = fract((uTime / life) + aAge + aSeed);
float age   = phase * life;
float birthT = uTime - age;                         // tiempo narrativo de nacimiento
float birthU = birthT / uLaunchDuration;            // parámetro de trayectoria al nacer
float alive  = step(uEmitWindow.x, birthU) * step(birthU, min(uLaunchProgress, uEmitWindow.y));
vec3  emitP  = samplePath(uPathLUT, birthU, 0.0);   // posición
vec3  emitT  = normalize(samplePath(uPathLUT, birthU, 1.0)); // tangente
vec3  origin = emitP - emitT * uNozzleOffset;
vec3  dir    = coneDirection(-emitT, aSpread);      // base ortonormal estable (Frisvad)
float drag   = LAYER_DRAG;                          // core 4.0, vapor 2.2, sparks 1.2
vec3  p = origin + dir * aVelocity * (1.0 - exp(-drag * age)) / drag;
p += radialExpand(dir, age) ;                       // expansión radial creciente (vapor)
p += turbulence(p * uNoiseScale + aNoiseOffset, age) * uTurbulence * age; // simplex fBm (tier 1–2) / curl (tier 3)
```

- **Tamaño**: `gl_PointSize = clamp(aSize * sizeOverLife(age/life) * uPixelRatio * uViewportHeight * projScale / -mv.z, 0., uMaxPointSize)`.
- Las partículas no vivas colapsan (`gl_PointSize = 0` y posición fuera de clip).
- **Varyings**: `vLife` (0..1), `vSeed`, `vIntensity` y `vDepthFade`.
- **Fade por edad**: core con caída rápida (`exp`); vapor con fade-in 0.1 y fade-out suave; sparks con un destello corto.
- **Atenuación espacial** por distancia a la tobera.
- **Variación cromática**: core de blanco a cian (`#F6F6FA` → `#58DDFB`) según `vLife`; vapor de `#C8C5D8` a `#E3DDF3`; sparks entre `#58DDFB` y `#BCEEFF`.
- **Reversibilidad**: es función pura de `uTime` y `uLaunchProgress`. Al hacer scroll hacia arriba las partículas vuelven exactamente a los estados anteriores.

### 11.5 Fragment shader (`exhaustFragment.glsl`)

- Sprite radial suave con `gl_PointCoord`: `r = length(gl_PointCoord - 0.5) * 2`, `falloff = exp(-r*r*k)`, y `discard` si `r > 1`. Evita sprites cuadrados.
- **Vapor (tier ≥ 2)**: fragmentación con fBm 2D sobre `gl_PointCoord + vSeed`, que erosiona el borde.
- **Salida premultiplicada**: `gl_FragColor = vec4(color * alpha, alpha)`. En el núcleo aditivo el alfa se ignora.

### 11.6 `noise.glsl`

- Simplex 3D (Ashima/McEwan, licencia MIT, citada en cabecera).
- `fbm` con `#define NOISE_OCTAVES` (tier 0: 1; tier 1: 2; tier 2: 3; tier 3: 4).
- `curlNoise` por diferencias finitas del potencial simplex vectorial, solo con `#define USE_CURL` (tier 3).
- Tier 0: hash/value noise de 1 octava.

### 11.7 Rebuild y presupuesto

- `ExhaustSystem.rebuild(counts)` regenera los `BufferGeometry` al cambiar de tier. Como el sistema no tiene estado, el cambio es invisible para la narrativa.
- La geometría tiene `frustumCulled = false` con `boundingSphere` manual que cubre el path.

---

## 12. Órbitas: `OrbitController.ts` + `createOrbitGeometry.ts`

### 12.1 Curvas paramétricas

- Clase `EllipseOrbitCurve extends Curve<Vector3>`.
- Fórmula: `P(u) = C + R(incl, rotY, roll) · (a cos 2πu, 0, b sin 2πu)`, con rotación aplicada mediante quaternion desde Euler `XYZ`.

| Órbita | Significado | a | b | inclinación X | rotY | roll Z | centro | grosor | color | intensidad | velocidad relativa |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Visibilidad | 3.0 | 2.1 | 12° | 0° | 4° | (0, 0.05, 0) | 0.014 | #7FE6FF (cian frío) | 1.0 | 1.0 |
| 2 | Relaciones | 2.8 | 2.5 | 58° | 40° | -18° | (0, 0, 0) | 0.013 | #6FE0FC | 1.0 | -0.8 |
| 3 | Resultados | 3.2 | 2.3 | -38° | -55° | 30° | (0, 0.25, 0) | 0.016 | #58DDFB | 1.3 | 0.6 |

- Al inicializar se verifica numéricamente que la distancia mínima de cada órbita al triángulo, a partir de los vértices `V_*` transformados, es mayor que `0.25`. Si no, se escalan `a` y `b`.
- Los puntos de intersección o máxima proximidad visual entre la órbita 1 y las órbitas 2 y 3 se calculan por muestreo (2048 muestras) en el espacio de pantalla de CAM_07. Son los puntos de ramificación `branchU`.

### 12.2 Geometría

- `TubeGeometry(curve, tubularSegments qc 256/384/512/512, radius, radialSegments 6/8/8/10, closed: true)`.
- `uv.x` se usa como parámetro de la curva.
- El tubo de lanzamiento usa `TubeGeometry(LaunchPath tramo A, 160, 0.012, 8, false)` con el mismo material.

### 12.3 Continuidad estela → órbitas

1. **Tramo A**: `launchTrail` dibuja el tubo de lanzamiento detrás del cilindro, con `uDrawEnd` igual al parámetro de la cabeza. Las partículas de vapor de vida larga cubren la misma trayectoria.
2. **Tramo B**: el cilindro recorre la elipse exacta de la órbita 1, así que la estela es la órbita 1. `orbitFormation0` dibuja desde `θE` hasta la cabeza (`uDrawStart = θE`, `uDrawEnd = θhead`). Al terminar el tramo B, el rango restante de la órbita 1 se completa en 86–89 desde ambos extremos hasta cerrar el anillo.
3. **Órbitas 2 y 3**: aparecen desde `branchU`, donde tocan visualmente la órbita 1, y crecen simétricamente en ambos sentidos (`uDrawStart = branchU - f/2`, `uDrawEnd = branchU + f/2`) hasta cerrarse. Un pulso de alta intensidad recorre la órbita 1 hasta cada punto de ramificación justo antes de que nazca la órbita correspondiente. No se usa fade desconectado.
4. **Tramo C**: el cilindro escapa por la tangente y la estela del escape se disipa. `launchTrail` se borra desde el vértice hacia la órbita (`uDrawStart` creciente).
5. **Sincronización**:
   - Fase angular de rotación del plano de cada órbita alrededor del eje Y global: `orbitPhase * speed_i`.
   - Fase de pulsos: `pulsePhase_i = mix(free_i, sharedPhase, orbitSynchronization)`, de modo que al sincronizarse los tres pulsos coinciden.
   - La rotación de la órbita 1 solo empieza cuando el cilindro la ha abandonado (≥ 86 %), para que no se separe de la trayectoria.
   - `orbitPhase` usa ease `power2.out` y desacelera hasta estabilizarse.
6. **Conexión y retorno**:
   - `orbitConnect` intensifica cada órbita en su punto más cercano a un vértice del triángulo (gaussiana sobre `u_closest_i`, calculado al inicializar) y, al mismo tiempo, `edgeLit` y `triangleEmission` concentran la luz en las aristas.
   - `returnPulse` mueve un pulso de perímetro desde el vértice superior hasta `BL`, que es el origen de la escena 3. Así se cierra el ciclo.

---

## 13. Energía: `EnergyController.ts`

**Motes**

- Son 4 sprites esféricos de luz: un `Points` de 4 vértices con shader de núcleo y halo, en las capas de bloom. No son objetos físicos ni cubos.
- `moteNeed` sigue el recorrido:
  1. `needTravel` 0–0.75: `perimeterPoint` de la arista 0, desde `BL` hasta su punto medio;
  2. 0.75–1: Bézier suave hacia `centroid + (dir * 0.18)`, deteniéndose cerca del centro;
  3. 1–1.15: llegada al centroide.
- `moteSplit[0..2]`:
  - `splitTravel` 0–0.25: del centroide al punto medio de cada arista;
  - 0.25–1: recorren cada arista hasta su vértice, en el mismo sentido perimetral, y llegan a la vez.

**Pulsos en el triángulo**

- Los pulsos de perímetro del shader (`uPulses`) se alimentan desde la posición `t` de cada mote mientras recorre una arista.
- `ascent` crea dos pulsos que suben desde `BL` (arista 2, en sentido inverso) y desde `BR` (arista 1) hasta `TOP`.
- `returnPulse` crea un pulso que recorre desde `TOP` hasta `BL`.

**Destello central y halo**

- `coreFlash` controla un sprite de halo en el centroide (escala 0 → 0.9) y un pico de la luz Energy.
- `haloWave` controla un anillo en el vértice superior, construido con un `RingGeometry` delgado orientado a cámara y `ShaderMaterial` con borde suave. Se expande en radio y se desvanece. Es una onda de luz, no una explosión.

**Cálculo**

- Todo se calcula en el espacio local del grupo del triángulo, para que el resultado sea coherente con su rotación.

---

## 14. Arquitectura del runtime

### 14.1 Responsabilidades

| Módulo | Responsabilidad |
|---|---|
| `RendererFactory` | Detecta capacidades y crea `WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false })`. Configura color y tone mapping. Expone `LiveSceneBackend` (único backend de escena para todos los tiers). WebGPU queda como rama no implementada en Fase 1. |
| `SceneRuntime` | Orquesta controladores; ejecuta el bucle `rAF`, el resize, la visibilidad, el context loss y `dispose`. |
| `createScene` | Construye una escena lógica única: triángulo, cilindro, shadow catcher, órbitas, tubo de lanzamiento, partículas, motes y luces. |
| `SceneController` | Aplica `StoryState` a transformaciones y uniforms de objetos. |
| `CameraController` | §6. |
| `LightingController` / `MaterialController` | §8 y §9. |
| `EnergyController` | §13. |
| `ParticleController` (`ExhaustSystem`) | §11. |
| `OrbitController` | §12. |
| `PostProcessingController` (`createWebGLPipeline`) | §10. |
| `TimelineController` (`storyTimeline`) | §5. Vive en React (`Story.tsx`) y comparte `StoryState` por referencia. |
| `PerformanceEvaluator` / `CapabilityDetector` / `RenderProfileManager` / `qualityProfiles` | §15. |
| `AssetManager` + `missingFills.ts` | §16. |

### 14.2 Bucle de render (`SceneRuntime.frame`)

1. Si la página está oculta o el stage está fuera de viewport, no hay render y el `rAF` se cancela.
2. Se lee `StoryState`, sin asignaciones por frame (vectores y quaterniones reutilizados).
3. Orden de actualización: `camera.update` → `scene.update` → `energy.update` → `orbits.update` → `particles.update` → `lighting.update` → `post.update`.
4. Render dirty-aware:
   - Si el estado cambió (hash numérico de los campos de `StoryState` más tamaño), se renderiza a la tasa del display.
   - Si no cambió y hay `ambientClock` activo, se renderiza a `qc.idleFps` (30).
   - Con reduced motion y sin cambios, no se renderiza.
5. `bloomComposer.render()` → `finalComposer.render()`.
6. `PerformanceEvaluator.sample(frameTime, gpuQuery)`.

### 14.3 Ciclo de vida y robustez

- **Pausa**: `document.visibilitychange` detiene el bucle y lo reanuda al volver. Un `IntersectionObserver` sobre `.stage` detiene el render cuando el canvas no está visible (por ejemplo, al final de la página).
- **`webglcontextlost`**:
  1. `event.preventDefault()`, detener el bucle y mostrar el poster estático (componente SVG del fallback) sobre el canvas, con fundido;
  2. en `webglcontextrestored`, `dispose` de los recursos GPU y reconstrucción de `createScene` y del pipeline con el mismo `StoryState`. La narrativa no se reinicia.
- **Reintentos**: hasta 2 reintentos de inicialización con backoff (500 ms y 2 s). Después se mantiene el fallback estático y se registra en consola un error con causa clara.
- **`dispose()`**: recorre la escena (geometrías, materiales, texturas y `DataTexture` de la LUT), las pasadas, los composers y sus render targets, el PMREM y el `envRT`, los observers y listeners, y finalmente `renderer.dispose()`. `SceneCanvas` lo invoca al desmontar, también en el doble montaje de StrictMode, protegido con una bandera `disposed` y abortando la inicialización asíncrona pendiente.
- **Errores**: `RendererFactory` captura las excepciones de creación de contexto y la compilación de shaders se comprueba con `renderer.debug.onShaderError` para registrar errores con contexto. Cualquier fallo lleva al fallback estático: no se muestra silenciosamente un estado incorrecto.

---

## 15. Calidad y scoring (versión preliminar de Fase 1)

La versión definitiva corresponde a la Fase 3. En Fase 1 se implementa el registro central, la detección de capacidades y una evaluación inicial real.

### 15.1 `qualityProfiles.ts` (registro central)

```ts
type TierId = 'REALTIME_SAFE'|'REALTIME_LOW'|'REALTIME_MEDIUM'|'REALTIME_HIGH';
interface QualityConfig {
  backend: 'webgl2';                      // Fase 1: siempre webgl2 (webgpu en Fase 2)
  pixelRatioCap: number; renderScale: number; msaa: 0|4;
  shadows: { enabled: boolean; mapSize: number; contactBlob: boolean };
  gtao: { enabled: boolean; samples: number; intensity: number };
  ssr: { enabled: boolean };
  bloom: { strength: number; radius: number; resolutionScale: number };
  dof: { enabled: boolean; apertureScale: number; maxBlur: number };
  smaa: boolean;
  particles: { core: number; vapor: number; sparks: number; maxPointSize: number; octaves: 1|2|3|4; curl: boolean; vaporErosion: boolean };
  geometry: { triangleBevelSegments: number; cylinderRadialSegments: number; orbitTubular: number; orbitRadial: number };
  idleFps: number;
}
```

| Campo | SAFE (0–34) | LOW (35–54) | MEDIUM (55–74) | HIGH (75–100) |
|---|---|---|---|---|
| pixelRatioCap | 1.0 | 1.25 | 1.5 | 2.0 |
| renderScale | 0.75 | 0.9 | 1.0 | 1.0 |
| msaa | 0 | 0 | 4 | 4 |
| shadows | blob de contacto | 1024 | 2048 | 2048 |
| gtao | off | off | on (8 samples, half-res) | on (16 samples) |
| ssr | off | off | off | on (selects) |
| bloom strength/res | 0.35 / 0.35 | 0.5 / 0.5 | 0.6 / 0.5 | 0.65 / 0.75 |
| dof | off | off | on (puntual) | on |
| smaa | on | on | off (MSAA) | off (MSAA) |
| partículas core/vapor/sparks | 1.5k/3k/0.3k | 3k/6k/0.6k | 6k/12k/1.2k | 10k/20k/2k |
| octavas/curl/erosión | 1/no/no | 2/no/no | 3/no/sí | 4/sí/sí |

- Todos los tiers usan `LiveSceneBackend` y la misma escena: solo cambia `qualityConfig`.
- En móvil se aplica un modificador: `pixelRatioCap ≤ 1.5`, partículas ×0.5 y `dof` off.

### 15.2 `CapabilityDetector.ts`

Detecta:

- WebGL 2 (contexto de prueba en un canvas offscreen, liberado inmediatamente con `WEBGL_lose_context`);
- `EXT_disjoint_timer_query_webgl2`, `EXT_color_buffer_half_float`/`float`, `OES_texture_float_linear`;
- `MAX_TEXTURE_SIZE`, `MAX_SAMPLES`;
- `navigator.gpu` (solo informativo en Fase 1), `deviceMemory`, `hardwareConcurrency`;
- `matchMedia('(pointer: coarse)')`, `prefers-reduced-motion` y el renderer desenmascarado, si se expone.

### 15.3 `PerformanceEvaluator.ts` (preliminar)

- **Muestreo**: durante los primeros 120 frames renderizados se muestrean:
  - tiempo GPU real con `EXT_disjoint_timer_query_webgl2` alrededor de las dos llamadas de composer, con queries en anillo, lectura asíncrona y descarte de `GPU_DISJOINT`;
  - tiempo de frame con `rAF` (p50/p95);
  - CPU del frame con `performance.now()` alrededor de la actualización JS, sin usarlo como GPU;
  - Long Tasks con `PerformanceObserver('longtask')`.
- **Puntuación**: GPU 45 / estabilidad 20 / CPU 15 / capacidades 10 / memoria 10.
  - Sin timer query, los 45 puntos de GPU se marcan como "no medidos": se usa la estabilidad de frames como proxy, se documenta la limitación en el resultado y no se presenta como tiempo GPU.
- **Selección y ajuste**: se arranca con un tier inicial heurístico por capacidades (MEDIUM en escritorio y LOW en móvil). Tras la evaluación, `RenderProfileManager` puede ajustar una vez.
- **Histéresis completa**: Fase 3.
- **Overrides**: `?tier=0..3`, `?ssr=0|1` y `?debug=1`, este último con un HUD que muestra progreso, capítulo, tier, score y frame times.

### 15.4 `RenderProfileManager.ts`

- `apply(config)` → `post.rebuild`, `particles.rebuild`, `lighting.setShadows` y `renderer.setPixelRatio`, sin tocar `StoryState` ni el timeline.

### 15.5 Sin WebGL 2

- `App` renderiza `StaticFallback`:
  - SVG inline del triángulo en perla con hairlines cian y tres elipses inclinadas;
  - todos los capítulos en flujo normal de documento;
  - CTA funcional.
- No se finge la escena 3D.
- `// TODO: MISSING_FILL(PRERENDER_VIDEO_SEGMENTS)`.

---

## 16. Assets y missing fills

### 16.1 `missingFills.ts`

- Registro tipado de los 15 IDs del brief más `PP_NEUE_MONTREAL_FONT` y `CONTACT_ENDPOINT`.
- Campos por entrada: `id`, `usage`, `scene`, `fileType`, `expectedPath` (`public/assets/...`), `dependencies`, `materials`, `transformContract`, `replaces`.

### 16.2 `AssetManager.ts`

- Interfaces de staged preloading:
  - `Stage 0: poster`, `1: capítulo actual`, `2: adyacentes`, `3: restantes`;
  - `preload(stage, chapter)`;
  - `getNearestFrame(progress)` para el futuro nearest-frame fallback.
- En Fase 1 todos los recursos se resuelven como `missing`, con log informativo único en desarrollo. No se descarga nada externo.

### 16.3 `docs/MISSING-FILLS.md`

- Para cada uno de los 15 IDs del brief, más los 2 adicionales: uso, escena de destino, tipo de archivo, ubicación prevista, dependencias, materiales requeridos, transformaciones compatibles, componente sustituido y referencia a su `TODO: MISSING_FILL(...)` en el código.

### 16.4 Comentarios en código

- `TODO: MISSING_FILL(...)` en cada punto de integración:
  - triángulo, cilindro, HDRI, lightmap/AO y texturas de material;
  - `StaticFallback` (vídeo/posters) y `AssetManager` (secuencia de imágenes);
  - capítulo 4 (storefront, conveyors, software cube, paquetes) y capítulo 5 (tanque vertical);
  - órbitas (nodos), fuente y CTA.

---

## 17. Accesibilidad y responsive

- `<canvas aria-hidden="true" tabindex="-1">`. Todo el contenido vive en HTML semántico (`nav`, `main`, `section`, encabezados jerárquicos).
- **Orden de foco**: navegación → panel activo (CTA o indicador) → ChapterRail. Cada elemento interactivo tiene un `:focus-visible` azul.
- **Contraste**:
  - Off-Black sobre `#f2f2f4` > 15:1.
  - Steel Gray `#5e5e5e` sobre `#f2f2f4` ≈ 5.9:1 (AA).
  - Ash Gray `#8f8f8f` ≈ 3.0:1, por lo que solo se usa en metadatos de 10px en mayúsculas sin carga informativa crítica. Se verifica y se documenta; las etiquetas de capítulo usan Steel Gray si la verificación lo exige.
- `prefers-reduced-motion`: §5.5.
- **Móvil**: §4.4, modificadores §15.1, un solo canvas.
- **Teclado**: las teclas de scroll nativas (Espacio, AvPág, flechas) funcionan sin interferencias.

---

## 18. Monitorización: `monitoring/webVitals.ts`

- `onLCP`, `onCLS`, `onINP`, `onFCP` y `onTTFB` (`web-vitals`) escriben en `window.__RISYNK_VITALS__` y, en desarrollo o con `?debug=1`, en `console.info`.
- Se separan explícitamente de las métricas GPU de `PerformanceEvaluator`.
- Queda preparado un reporter con endpoint configurable en el futuro, sin endpoint en Fase 1.

---

## 19. Bootstrap de Figma Make y despliegue

Se ejecuta después de que exista el código de la aplicación.

- `.figma/make/install`: `#!/usr/bin/env bash`, `set -euo pipefail`, `exec npm ci`. Ejecutable.
- `.figma/make/dev`: `exec npx vite --port "$PORT" --host 0.0.0.0 --strictPort`. Ejecutable y con `exec`.
- `.figma/make/dev.json`: `installOn: ["package.json", "package-lock.json"]`.
- Si los logs muestran un origen del preview bloqueado, se aplica `server.allowedHosts` condicionado a `process.env.FIGMA`, usando `FIGMA_PUBLIC_URL`.
- `figma make verify-bootstrap` en bucle hasta `success`, revisando los logs de install y dev.
- Después, con las skills `make-deploy` y `make-deploy-preview`, se preparan `.figma/make/deploy` y `deploy-preview`, y se ejecutan `figma make verify-deploy` (debe tener éxito) y `figma make verify-deploy-preview`, aplicando las reglas de la skill (no es un proyecto Payload).

---

## 20. Orden de ejecución (Fase 1)

1. Scaffold manual (sin plantilla interactiva): `package.json`, configuración TS/Vite e `index.html`; instalación de las dependencias de §1.1.
2. Tokens, estilos globales, `storyContent.ts`, Navigation, ChapterPanel, ChapterRail, ContactCTA y Story con layout sticky (aún sin canvas). Verificación del layout responsive.
3. `storyState`, `storyChapters` y `storyTimeline` con textos e indicador de progreso funcionando, y anclas de navegación.
4. `RendererFactory`, `SceneRuntime`, `SceneCanvas`, entorno, luces, `backgroundMatch` y pipeline básico (Render + Output + SMAA).
5. Triángulo: geometría, material extendido, reveal, emisión y sombras.
6. Presets, `CameraController` y conexión al timeline (`cameraU`).
7. `EnergyController`: motes, pulsos, flash, ascenso y halo.
8. Cilindro: material, materialización, alineación, `LaunchPath`, LUT y `launchEase`.
9. `ExhaustSystem` (tres capas) y `noise.glsl`.
10. Órbitas: curvas, tubos, draw-in, ramificación, sincronización, conexión y retorno.
11. Bloom selectivo (máscara + `BloomMix`), GTAO, Bokeh, SSR (tier 3) y MSAA.
12. Calidad: perfiles, `CapabilityDetector`, `PerformanceEvaluator` preliminar, overrides y HUD de depuración.
13. Reduced motion, `StaticFallback`, context loss, visibilidad y `dispose`.
14. `webVitals`, `AssetManager` y `missingFills`; documentos en `docs/`.
15. Bootstrap de Make y verificación de deploy/deploy-preview (§19).
16. Verificación (§21) e informe.

---

## 21. Verificación de Fase 1

**Build y typecheck**

- `npm run typecheck` y `npm run build`, ambos con salida 0. Los resultados se transcriben en el informe.

**Bootstrap y deploy**

- `figma make verify-bootstrap` → `success`; `figma make verify-deploy` → éxito; `figma make verify-deploy-preview` según la skill.

**Navegador**

- Se comprueba con `discover` si hay herramientas de navegador o captura disponibles. Si las hay:
  - Capturas en escritorio (1440×900) y móvil (390×844) en los progresos 0, 0.10, 0.22, 0.27, 0.36, 0.40, 0.50, 0.56, 0.66, 0.71, 0.78, 0.86, 0.95 y 1.0. Se usa `?debug=1&p=<progress>`, que hace `scrollTo` al progreso.
  - Barrido de scroll hacia arriba para validar la reversibilidad, comparando capturas en el mismo progreso tras bajar y tras subir.
  - Captura de consola sin errores.
  - Si solo hay WebGL por software (SwiftShader), se indica en el informe y las capturas se interpretan como validación funcional, no de rendimiento.
- Si no hay herramientas de navegador, se informa explícitamente y no se afirma la verificación visual.

**Determinismo y reversibilidad**

- En `?debug=1` se ejecuta una autoprueba que fija `progress = p`, lee el estado derivado (posición de cámara y del cilindro) y repite tras recorrer `0 → 1 → p`. La diferencia debe ser menor de 1e-6.

**Calidad visual**

- Se fuerza cada tier con `?tier=0..3` y se confirma que todos renderizan la misma narrativa.

**Tabla de aceptación**

- El informe incluye los 20 criterios de la Fase 1 con su estado (✔ / parcial / ✘) y la evidencia correspondiente.

---

## 22. Riesgos conocidos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Bloom invisible o blanqueado sobre fondo claro | Máscara emisiva + `BloomMixShader` teñido; intensidades HDR ≤ 2.2 |
| AgX desatura el cian | Inlay oscurecido bajo la emisión; intensidad acotada; ajuste de exposición |
| Fondo de canvas ≠ `#f2f2f4` | Solver inverso AgX + verificación por píxel |
| `discard` del reveal rompe GTAO, Bokeh y profundidad | `customDepthMaterial`; `gtaoBlend = 0` durante el reveal; DoF bajo en el reveal |
| SSR costoso o con artefactos | Solo tier 3, `selects` y override `?ssr=0` |
| Vapor sin ordenar con alpha blending | Premultiplicado, `depthWrite false` y alfa bajo; validación visual |
| Doble montaje de StrictMode | Init abortable + `dispose` idempotente |
| Desajuste emisor ↔ cilindro | LUT única compartida por JS y GLSL |
| WebGL por software en verificación | Se documenta; capturas como validación funcional |

---

## 23. Pendiente de confirmación por el usuario

1. **Destino real del CTA** `Hablemos de tu proyecto` y del enlace `Contacto` (email o URL). Hasta recibirlo, queda como `MISSING_FILL(CONTACT_ENDPOINT)`, documentado.
2. **Archivo y licencia de PP Neue Montreal**, si se desea usar en lugar de Inter Variable.

---

## 24. Fuera de alcance de Fase 1 (no se ejecuta)

- Fase 2: TSL/WebGPU, RenderPipeline, MRT, SSGI, TAAU, transmisión y refinamiento de realismo.
- Fase 3: scoring definitivo, resolución dinámica, histéresis y degradación.
- Fase 4: production readiness.

**Al completar la Fase 1: detener y esperar autorización para la Fase 2.**
