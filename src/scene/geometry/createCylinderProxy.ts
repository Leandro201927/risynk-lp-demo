import { CylinderGeometry, Group, Mesh, type Material } from 'three';
import type { QualityConfig } from '../quality/qualityProfiles';

export const CYL = { radius: 0.13, height: 0.9 } as const;

export interface CylinderProxy {
  group: Group; // origen en el centro del cilindro, avance hacia +Y local
  mesh: Mesh;
  nozzleLocalY: number;
  dispose: () => void;
}

/** TODO: MISSING_FILL(ROCKET_FINAL_GLB) — debe conservar eje +Y, longitud normalizada 0.9 y un nodo 'Nozzle'. */
export function createCylinderProxy(material: Material, q: QualityConfig): CylinderProxy {
  const geometry = new CylinderGeometry(CYL.radius, CYL.radius, CYL.height, q.geometry.cylinderRadialSegments, 24, false);
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'RocketProxy';
  const group = new Group();
  group.name = 'RocketRoot';
  group.add(mesh);
  return { group, mesh, nozzleLocalY: -CYL.height / 2, dispose: () => geometry.dispose() };
}
