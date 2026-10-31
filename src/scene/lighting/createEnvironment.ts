import { PMREMGenerator, type Texture, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface EnvironmentHandle {
  texture: Texture;
  dispose: () => void;
}

/**
 * Entorno de estudio procedural (RoomEnvironment) filtrado con PMREM para reflejos suaves sobre la cerámica.
 * TODO: MISSING_FILL(BRANDED_HDRI) / MISSING_FILL(PRODUCTION_HDRI) — AssetManager.load('hdri') -> RGBELoader/EXRLoader
 * -> pmrem.fromEquirectangular(), sustituyendo este handle sin tocar materiales.
 */
export function createEnvironment(renderer: WebGLRenderer): EnvironmentHandle {
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const rt = pmrem.fromScene(room, 0.04);
  room.traverse((o) => {
    const m = o as unknown as { geometry?: { dispose(): void }; material?: { dispose(): void } | Array<{ dispose(): void }> };
    m.geometry?.dispose();
    if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
    else m.material?.dispose();
  });
  pmrem.dispose();
  return { texture: rt.texture, dispose: () => rt.dispose() };
}
