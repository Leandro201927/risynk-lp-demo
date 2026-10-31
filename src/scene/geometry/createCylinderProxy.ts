import { Group, LatheGeometry, Mesh, Vector2, type Material } from 'three';
import type { QualityConfig } from '../quality/qualityProfiles';

export const CYL = { radius: 0.11, height: 1.0 } as const;

export interface CylinderProxy {
  group: Group; // origen en el centro del cohete, avance hacia +Y local
  mesh: Mesh;
  nozzleLocalY: number;
  dispose: () => void;
}

/** Perfil de torno: tobera acampanada, cuerpo cilíndrico limpio y ojiva definida. Eje +Y, y ∈ [-0.5, 0.5]. */
function rocketProfile(): Vector2[] {
  const r = CYL.radius;
  const pts: Vector2[] = [
    new Vector2(0.0, -0.5),
    new Vector2(0.062, -0.5),
    new Vector2(0.074, -0.485),
    new Vector2(0.092, -0.45),
    new Vector2(0.104, -0.415),
    new Vector2(r, -0.385), // arranque del cuerpo
    new Vector2(r, 0.1),
  ];
  const noseLen = 0.4;
  const n = 14;
  for (let i = 1; i <= n; i++) {
    const s = i / n;
    pts.push(new Vector2(r * Math.pow(Math.max(0, 1 - s * s), 0.62), 0.1 + noseLen * s)); // ojiva suave, punta redondeada
  }
  return pts;
}

/** TODO: MISSING_FILL(ROCKET_FINAL_GLB) — debe conservar eje +Y, longitud normalizada 1.0 y un nodo 'Nozzle'. */
export function createCylinderProxy(material: Material, q: QualityConfig): CylinderProxy {
  const geometry = new LatheGeometry(rocketProfile(), q.geometry.cylinderRadialSegments);
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'RocketProxy';
  const group = new Group();
  group.name = 'RocketRoot';
  group.add(mesh);
  return { group, mesh, nozzleLocalY: -CYL.height / 2, dispose: () => geometry.dispose() };
}
