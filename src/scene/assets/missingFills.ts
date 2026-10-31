/** Registro tipado de recursos pendientes. Ninguno de estos recursos existe todavía: no se simula su implementación. */
export interface MissingFill {
  id: string;
  usage: string;
  scene: string;
  fileType: string;
  expectedPath: string;
  dependencies: string;
  materials: string;
  transformContract: string;
  replaces: string;
}

const f = (id: string, usage: string, scene: string, fileType: string, expectedPath: string, dependencies: string, materials: string, transformContract: string, replaces: string): MissingFill => ({
  id, usage, scene, fileType, expectedPath, dependencies, materials, transformContract, replaces,
});

export const MISSING_FILLS: MissingFill[] = [
  f('PENROSE_FINAL_GLB', 'Estructura Penrose definitiva', '01-06', 'glTF binario (.glb)', 'public/assets/models/penrose.glb', 'AssetManager, MaterialController', 'Cerámica perla + inlay emisivo', "Grupo 'TriangleRoot', centroide en origen, circunradio ≈1.386, tres vigas ordenadas BL→BR→TOP, cara plana en el vértice superior, perimeterPoint(t)", 'createTriangleProxy()'),
  f('STOREFRONT_FINAL_GLB', 'Storefront que se transforma', '01, 04', 'glb', 'public/assets/models/storefront.glb', 'Timeline cap. 1 y 4', 'PBR de producción', 'Apoyado en la cara interior de la viga inferior; zona de luz en STORE.doorCenter', 'createStorefront() (fachada procedural)'),
  f('CONVEYOR_ASSETS', 'Conveyor belts del proceso', '04', 'glb', 'public/assets/models/conveyor/*.glb', 'EnergyController', 'PBR de producción', 'Recorren las aristas (perimeterPoint)', 'Pulsos de perímetro del shader'),
  f('SOFTWARE_CUBE_GLB', 'Software cube', '04', 'glb', 'public/assets/models/software-cube.glb', 'EnergyController', 'PBR de producción', 'Sigue el mote de energía', 'Motes de energía'),
  f('PACKAGE_GLB', 'Paquetes', '04', 'glb', 'public/assets/models/package.glb', 'EnergyController', 'PBR de producción', 'Sigue el mote de energía', 'Motes de energía'),
  f('VERTICAL_TANK_GLB', 'Columna / depósito de acumulación', '05', 'glb', 'public/assets/models/vertical-tank.glb', 'Timeline cap. 5', 'PBR + emisión', 'Base en el vértice superior', 'createLaunchMount() + ascenso de energía + carga del vértice + halo'),
  f('ROCKET_FINAL_GLB', 'Cohete definitivo', '05-06', 'glb', 'public/assets/models/rocket.glb', 'LaunchPath, ExhaustSystem', 'Cerámica + tobera emisiva', "Eje +Y, longitud 1.0, nodo 'Nozzle'", 'createCylinderProxy()'),
  f('ORBIT_NODE_MODELS', 'Nodos de las órbitas', '06', 'glb', 'public/assets/models/orbit-nodes/*.glb', 'OrbitController', 'PBR + emisión', 'Posicionados por parámetro u de cada órbita', 'Pulsos gaussianos del tubo'),
  f('PRERENDER_VIDEO_SEGMENTS', 'Vídeos prerenderizados (Blender)', '01-06', 'mp4/webm', 'public/assets/video/chapter-*.mp4', 'AssetManager (staged preload)', '—', 'Mismo orden narrativo', 'Fallback sin WebGL (StaticFallback)'),
  f('PRERENDER_VIDEO_POSTERS', 'Posters de los vídeos', '01-06', 'webp/avif', 'public/assets/video/posters/*.webp', 'AssetManager Stage 0', '—', '—', 'StaticFallback'),
  f('NEAREST_FRAME_IMAGE_SEQUENCE', 'Secuencia de imágenes para nearest-frame', '01-06', 'webp', 'public/assets/frames/*.webp', 'AssetManager.getNearestFrame', '—', 'Indexada por progreso', 'StaticFallback'),
  f('BAKED_LIGHTMAP_ATLAS', 'Irradiancia indirecta horneada', '01-06', 'png/exr (uv1)', 'public/assets/lightmaps/atlas.exr', 'MaterialController.applyBakedLighting', 'lightMap', 'uv1 sin solapes', 'IBL + luz de relleno (se reduce al activar)'),
  f('BAKED_AO_ATLAS', 'AO horneado', '01-06', 'png (uv1)', 'public/assets/lightmaps/ao.png', 'MaterialController.applyBakedLighting', 'aoMap', 'uv1 sin solapes', 'GTAO en perfiles bajos'),
  f('PRODUCTION_HDRI', 'HDRI de producción', '01-06', 'hdr/exr', 'public/assets/hdri/studio.hdr', 'createEnvironment', 'envMap', 'Lineal, sin conversión sRGB', 'RoomEnvironment'),
  f('PRODUCTION_MATERIAL_TEXTURES', 'Texturas de material de producción', '01-06', 'ktx2/webp', 'public/assets/textures/*', 'Materiales', 'map/normalMap/roughnessMap', 'Color en sRGB, técnicos en NoColorSpace', 'Ruido procedural de rugosidad'),
  f('PP_NEUE_MONTREAL_FONT', 'Tipografía PP Neue Montreal (peso 350)', 'UI', 'woff2', 'src/assets/fonts/PPNeueMontreal-350.woff2', 'tokens.css', '—', '—', 'Inter Variable'),
  f('CONTACT_ENDPOINT', 'Destino real del CTA de contacto', 'UI cap. 6', 'URL / mailto', 'src/content/storyContent.ts (CONTACT.href)', '—', '—', '—', 'mailto placeholder documentado'),
];
