# RENDERING-ARCHITECTURE

## Capas
```text
React (Story)           master timeline GSAP + ScrollTrigger  ──escribe──▶  StoryState (números planos)
                                                                              │ lee
SceneCanvas ▶ SceneRuntime ▶ LiveSceneBackend (única escena) ▶ WebGLPipeline ▶ canvas
                 │                  │ CameraController · LightingController · EnergyController
                 │                  │ OrbitController · ExhaustSystem · LaunchPath
                 └ PerformanceEvaluator · RenderProfileManager · AssetManager
```
- **Una escena, una cámara, una timeline.** Los tiers solo cambian `QualityConfig`.
- `StoryState` es la única referencia temporal. Todas las posiciones son función del progreso de scroll (determinista, reversible). El único reloj de pared (`ambient`) solo modula sombreado (parpadeo de ±8 % en el núcleo del escape, pulsos de órbitas en reposo) y se desactiva con `prefers-reduced-motion`.

## Pipeline WebGL 2 (`createWebGLPipeline.ts`)
```text
bloomComposer (media resolución)           finalComposer (HalfFloat, MSAA×4 en tiers 2–3)
  RenderPass (materiales de máscara)         RenderPass
  UnrealBloomPass (threshold 0)              GTAOPass (tiers 2–3; gtaoBlend=0 durante el reveal)
          │ textura                          ShaderPass BloomMix (halo teñido, no aditivo)
          └──────────────────────────────▶  BokehPass (tiers 2–3; apertura×dofAmount)
                                             OutputPass (AgX + sRGB: única transformación)
                                             SMAAPass (tiers 0–1)
```
- **Bloom selectivo real**: cada objeto declara `userData.bloom` (`'self'`, un material de máscara o `'hide'`). En la pasada de máscara el triángulo y el cilindro usan materiales que solo emiten cian y ocluyen en negro; el vapor y la sombra se ocultan. El `discard` del reveal se replica en esos materiales.
- **BloomMix**: sobre un estudio high-key el bloom aditivo satura a blanco. El halo multiplica la imagen por el tinte (resta rojo) → se lee cian.
- **Color**: working space lineal, `AgXToneMapping` aplicado una vez en `OutputPass`. El fondo se resuelve con un AgX inverso (`backgroundMatch.ts`) para que el canvas coincida con `#f2f2f4`.

## Materiales
- Triángulo: `MeshPhysicalMaterial` + `onBeforeCompile`. Coordenada de perímetro analítica en fragment (sin atributos), reveal por arista (`discard` + borde luminoso), inlay emisivo oscureciendo el albedo bajo la emisión (evita saturar a blanco), pulsos gaussianos (6 slots), barrido y carga del vértice. `customDepthMaterial` replica el reveal.
- Cohete: perfil de torno procedural (tobera acampanada, cuerpo cilíndrico, ojiva), `MeshPhysicalMaterial` cerámico; se *construye* con un barrido axial de energía desde la tobera hacia la punta mientras reposa en su cuna (`createLaunchMount`). Banda cian e interior de tobera emisivos.
- Órbitas y estela: `ShaderMaterial` tubular con rango de dibujo circular, fresnel y pulsos sincronizables.
- Partículas: tres `Points` con `ShaderMaterial` (núcleo aditivo, vapor y chispas premultiplicados), simplex/curl noise por tier.
- **WebGPU/TSL**: no implementado en Fase 1. `RendererFactory` lo declara y cae a WebGL 2. Los materiales GLSL no se portarán automáticamente: requieren equivalentes TSL (Fase 2).

## Trayectoria compartida (`launchPath.ts`)
Tres tramos con continuidad C1: A (Bézier del vértice a la entrada del anillo 1), B (arco exacto de la elipse de la órbita 1) y C (escape). Parametrizada por longitud de arco; `qToS` mapea el progreso narrativo `q` (fronteras 0.30 y 0.86) a la fracción de arco. Una LUT de 512×2 `Float32` se comparte entre JS (cilindro, cámara) y GLSL (emisor de partículas).

## Partículas deterministas
Cada partícula es una función pura de `uTime` (segundos narrativos = 6·s) y `uLaunchProgress`: `phase = fract(uTime/life + aAge + aSeed)`, `birthU = (uTime − age)/6`, posición = punto de la LUT en `birthU` + cono, drag, expansión radial y turbulencia. No hay simulación acumulativa: el scroll inverso la deshace.

## Calidad
`qualityProfiles.ts` es el registro central. `CapabilityDetector` mide WebGL 2, extensiones, memoria y núcleos. `PerformanceEvaluator` usa `EXT_disjoint_timer_query_webgl2` cuando existe; si no, marca el GPU como **no medido** y usa la estabilidad de frames como proxy declarado. Un renderer por software nunca supera el tier SAFE.

## Ciclo de vida
Canvas nuevo por montaje (StrictMode), reintentos de inicialización (500 ms, 2 s), pausa con `visibilitychange` e `IntersectionObserver`, render dirty-aware (idle a 20–30 fps, nada con reduced motion), `webglcontextlost/restored` con reconstrucción sin reiniciar la narrativa, `dispose()` completo y fallback estático HTML/SVG si WebGL 2 falla.

## Puntos de integración futuros
Ver `docs/MISSING-FILLS.md` y los comentarios `TODO: MISSING_FILL(...)`.


## Dirección de arte revisada (Fase 1b)
- **Cámara:** planos autorados (`cameraPresets.ts`) interpolados en espacio orbital; framing responsive separado y solo-ampliador. Detalle en `docs/CAMERA-DIRECTION.md`.
- **Triángulo:** tres vigas de sección rectangular con inglete y escalón helicoidal en cada unión (cada viga asciende un espesor: solapes cíclicos tipo Penrose, geometría físicamente válida). Cada viga conoce su arista (`uBeamIdx`, `uBStart`, `uBDir`, `uBLen`), de modo que el parámetro de perímetro, el reveal y los pulsos se calculan sin búsqueda de arista cercana. Inlay cian hundido en la cara frontal; el vértice superior se recorta en plano para alojar la cuna de lanzamiento.
- **Material:** cerámica nacarada opaca (sheen lavanda + iridiscencia leve), luz de estudio desde arriba-izquierda y rim cian-hielo desde atrás-derecha. Exposición 1.3 (el fondo se resuelve con el mismo valor).
- **Fachada procedural** (`createStorefront`): plinto, volumen, marco de acceso, marquesina y zonas de luz sobre la cara interior de la viga inferior. Es el símbolo del negocio (escena 01) y el nodo central que recibe y reparte la energía (escena 04).
- **Energía:** un solo punto de necesidad sobre la viga inferior; en la escena 04 llega a la fachada y se reparte de forma escalonada por las tres vigas con líneas de flujo finas; en la escena 05 convergen dos pulsos en el vértice, que carga la cuna.
- **Órbitas:** tres elipses idénticas en forma y distintas en plano (0° y ±60° alrededor del eje del punto de ramificación): imágenes especulares que comparten dos nodos. Mayores que el triángulo para que el núcleo quede libre.
- **Partículas:** capa de vapor reducida a una neblina mínima de partículas pequeñas y vida corta; el peso lo llevan núcleo y chispas, concentrados en la trayectoria.
- **Bloom:** más contenido; el núcleo de los emisores pasa de tinte multiplicativo a aditivo para no virar a azul marino.
- **Máscara editorial:** el contenedor del canvas se desvanece hacia la columna de texto (`--stage-mask-a/b`, fijados desde `SceneRuntime.resize`).
- **Pasadas de profundidad:** los planos de suelo y los billboards de luz se excluyen del AO y del DoF (producían rectángulos y estrías).
