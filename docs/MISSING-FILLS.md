# MISSING_FILLS

Recursos pendientes. **Ninguno existe todavía y ninguno está simulado**: cada punto de integración en el código lleva un comentario `TODO: MISSING_FILL(ID)`.
Fuente única: `src/scene/assets/missingFills.ts` (este documento se genera desde ese registro).

## MISSING_FILL(PENROSE_FINAL_GLB)

- **Uso:** Estructura Penrose definitiva
- **Escena de destino:** 01-06
- **Tipo de archivo previsto:** glTF binario (.glb)
- **Ubicación prevista:** `public/assets/models/penrose.glb`
- **Dependencias:** AssetManager, MaterialController
- **Materiales requeridos:** Cerámica perla + inlay emisivo
- **Transformaciones compatibles:** Grupo 'TriangleRoot', centroide en origen, circunradio ≈1.386, tres vigas ordenadas BL→BR→TOP, cara plana en el vértice superior, perimeterPoint(t)
- **Componente que sustituye:** createTriangleProxy()

## MISSING_FILL(STOREFRONT_FINAL_GLB)

- **Uso:** Storefront que se transforma
- **Escena de destino:** 01, 04
- **Tipo de archivo previsto:** glb
- **Ubicación prevista:** `public/assets/models/storefront.glb`
- **Dependencias:** Timeline cap. 1 y 4
- **Materiales requeridos:** PBR de producción
- **Transformaciones compatibles:** Apoyado en la cara interior de la viga inferior; zona de luz en STORE.doorCenter
- **Componente que sustituye:** createStorefront() (fachada procedural)

## MISSING_FILL(CONVEYOR_ASSETS)

- **Uso:** Conveyor belts del proceso
- **Escena de destino:** 04
- **Tipo de archivo previsto:** glb
- **Ubicación prevista:** `public/assets/models/conveyor/*.glb`
- **Dependencias:** EnergyController
- **Materiales requeridos:** PBR de producción
- **Transformaciones compatibles:** Recorren las aristas (perimeterPoint)
- **Componente que sustituye:** Pulsos de perímetro del shader

## MISSING_FILL(SOFTWARE_CUBE_GLB)

- **Uso:** Software cube
- **Escena de destino:** 04
- **Tipo de archivo previsto:** glb
- **Ubicación prevista:** `public/assets/models/software-cube.glb`
- **Dependencias:** EnergyController
- **Materiales requeridos:** PBR de producción
- **Transformaciones compatibles:** Sigue el mote de energía
- **Componente que sustituye:** Motes de energía

## MISSING_FILL(PACKAGE_GLB)

- **Uso:** Paquetes
- **Escena de destino:** 04
- **Tipo de archivo previsto:** glb
- **Ubicación prevista:** `public/assets/models/package.glb`
- **Dependencias:** EnergyController
- **Materiales requeridos:** PBR de producción
- **Transformaciones compatibles:** Sigue el mote de energía
- **Componente que sustituye:** Motes de energía

## MISSING_FILL(VERTICAL_TANK_GLB)

- **Uso:** Columna / depósito de acumulación
- **Escena de destino:** 05
- **Tipo de archivo previsto:** glb
- **Ubicación prevista:** `public/assets/models/vertical-tank.glb`
- **Dependencias:** Timeline cap. 5
- **Materiales requeridos:** PBR + emisión
- **Transformaciones compatibles:** Base en el vértice superior
- **Componente que sustituye:** createLaunchMount() + ascenso de energía + carga del vértice + halo

## MISSING_FILL(ROCKET_FINAL_GLB)

- **Uso:** Cohete definitivo
- **Escena de destino:** 05-06
- **Tipo de archivo previsto:** glb
- **Ubicación prevista:** `public/assets/models/rocket.glb`
- **Dependencias:** LaunchPath, ExhaustSystem
- **Materiales requeridos:** Cerámica + tobera emisiva
- **Transformaciones compatibles:** Eje +Y, longitud 1.0, nodo 'Nozzle'
- **Componente que sustituye:** createCylinderProxy()

## MISSING_FILL(ORBIT_NODE_MODELS)

- **Uso:** Nodos de las órbitas
- **Escena de destino:** 06
- **Tipo de archivo previsto:** glb
- **Ubicación prevista:** `public/assets/models/orbit-nodes/*.glb`
- **Dependencias:** OrbitController
- **Materiales requeridos:** PBR + emisión
- **Transformaciones compatibles:** Posicionados por parámetro u de cada órbita
- **Componente que sustituye:** Pulsos gaussianos del tubo

## MISSING_FILL(PRERENDER_VIDEO_SEGMENTS)

- **Uso:** Vídeos prerenderizados (Blender)
- **Escena de destino:** 01-06
- **Tipo de archivo previsto:** mp4/webm
- **Ubicación prevista:** `public/assets/video/chapter-*.mp4`
- **Dependencias:** AssetManager (staged preload)
- **Materiales requeridos:** —
- **Transformaciones compatibles:** Mismo orden narrativo
- **Componente que sustituye:** Fallback sin WebGL (StaticFallback)

## MISSING_FILL(PRERENDER_VIDEO_POSTERS)

- **Uso:** Posters de los vídeos
- **Escena de destino:** 01-06
- **Tipo de archivo previsto:** webp/avif
- **Ubicación prevista:** `public/assets/video/posters/*.webp`
- **Dependencias:** AssetManager Stage 0
- **Materiales requeridos:** —
- **Transformaciones compatibles:** —
- **Componente que sustituye:** StaticFallback

## MISSING_FILL(NEAREST_FRAME_IMAGE_SEQUENCE)

- **Uso:** Secuencia de imágenes para nearest-frame
- **Escena de destino:** 01-06
- **Tipo de archivo previsto:** webp
- **Ubicación prevista:** `public/assets/frames/*.webp`
- **Dependencias:** AssetManager.getNearestFrame
- **Materiales requeridos:** —
- **Transformaciones compatibles:** Indexada por progreso
- **Componente que sustituye:** StaticFallback

## MISSING_FILL(BAKED_LIGHTMAP_ATLAS)

- **Uso:** Irradiancia indirecta horneada
- **Escena de destino:** 01-06
- **Tipo de archivo previsto:** png/exr (uv1)
- **Ubicación prevista:** `public/assets/lightmaps/atlas.exr`
- **Dependencias:** MaterialController.applyBakedLighting
- **Materiales requeridos:** lightMap
- **Transformaciones compatibles:** uv1 sin solapes
- **Componente que sustituye:** IBL + luz de relleno (se reduce al activar)

## MISSING_FILL(BAKED_AO_ATLAS)

- **Uso:** AO horneado
- **Escena de destino:** 01-06
- **Tipo de archivo previsto:** png (uv1)
- **Ubicación prevista:** `public/assets/lightmaps/ao.png`
- **Dependencias:** MaterialController.applyBakedLighting
- **Materiales requeridos:** aoMap
- **Transformaciones compatibles:** uv1 sin solapes
- **Componente que sustituye:** GTAO en perfiles bajos

## MISSING_FILL(PRODUCTION_HDRI)

- **Uso:** HDRI de producción
- **Escena de destino:** 01-06
- **Tipo de archivo previsto:** hdr/exr
- **Ubicación prevista:** `public/assets/hdri/studio.hdr`
- **Dependencias:** createEnvironment
- **Materiales requeridos:** envMap
- **Transformaciones compatibles:** Lineal, sin conversión sRGB
- **Componente que sustituye:** RoomEnvironment

## MISSING_FILL(PRODUCTION_MATERIAL_TEXTURES)

- **Uso:** Texturas de material de producción
- **Escena de destino:** 01-06
- **Tipo de archivo previsto:** ktx2/webp
- **Ubicación prevista:** `public/assets/textures/*`
- **Dependencias:** Materiales
- **Materiales requeridos:** map/normalMap/roughnessMap
- **Transformaciones compatibles:** Color en sRGB, técnicos en NoColorSpace
- **Componente que sustituye:** Ruido procedural de rugosidad

## MISSING_FILL(PP_NEUE_MONTREAL_FONT)

- **Uso:** Tipografía PP Neue Montreal (peso 350)
- **Escena de destino:** UI
- **Tipo de archivo previsto:** woff2
- **Ubicación prevista:** `src/assets/fonts/PPNeueMontreal-350.woff2`
- **Dependencias:** tokens.css
- **Materiales requeridos:** —
- **Transformaciones compatibles:** —
- **Componente que sustituye:** Inter Variable

## MISSING_FILL(CONTACT_ENDPOINT)

- **Uso:** Destino real del CTA de contacto
- **Escena de destino:** UI cap. 6
- **Tipo de archivo previsto:** URL / mailto
- **Ubicación prevista:** `src/content/storyContent.ts (CONTACT.href)`
- **Dependencias:** —
- **Materiales requeridos:** —
- **Transformaciones compatibles:** —
- **Componente que sustituye:** mailto placeholder documentado
