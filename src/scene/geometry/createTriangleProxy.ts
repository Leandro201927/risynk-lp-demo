import {
  BufferGeometry, ExtrudeGeometry, Group, Mesh, Shape, Path, Vector2, Vector3, MathUtils,
  type Material,
} from 'three';
import type { QualityConfig } from '../quality/qualityProfiles';

// Medidas (unidades de escena). Triángulo equilátero con marco hueco extruido y biselado.
export const TRI = {
  side: 2.4,
  frame: 0.3,
  depth: 0.3,
  bevelThickness: 0.035,
  bevelSize: 0.03,
} as const;
const R = TRI.side / Math.sqrt(3); // circunradio ≈ 1.386
const OUT_CORNER = 0.12;
const IN_CORNER = 0.06;

function equilateral(circumradius: number): Vector2[] {
  const h = circumradius / 2;
  const half = (circumradius * Math.sqrt(3)) / 2;
  return [new Vector2(0, circumradius), new Vector2(-half, -h), new Vector2(half, -h)]; // TOP, BL, BR
}

/** Contorno CCW con esquinas redondeadas (curva cuadrática con el vértice como control). */
function roundedPath<T extends Shape | Path>(target: T, verts: Vector2[], trim: number): T {
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const v = verts[i] as Vector2;
    const prev = verts[(i + n - 1) % n] as Vector2;
    const next = verts[(i + 1) % n] as Vector2;
    const a = v.clone().add(prev.clone().sub(v).normalize().multiplyScalar(trim));
    const b = v.clone().add(next.clone().sub(v).normalize().multiplyScalar(trim));
    if (i === 0) target.moveTo(a.x, a.y);
    else target.lineTo(a.x, a.y);
    target.quadraticCurveTo(v.x, v.y, b.x, b.y);
  }
  target.closePath();
  return target;
}

/** Medidas analíticas del marco (sin crear geometría): usadas para inicializar uniforms de los materiales. */
export function triangleMetrics(): Pick<TriangleProxy, 'centerline' | 'halfWidth' | 'depthHalf'> {
  const cr = (R / 2 - TRI.frame / 2) * 2;
  return {
    centerline: [
      new Vector3(-(cr * Math.sqrt(3)) / 2, -cr / 2, 0),
      new Vector3((cr * Math.sqrt(3)) / 2, -cr / 2, 0),
      new Vector3(0, cr, 0),
    ],
    halfWidth: TRI.frame / 2,
    depthHalf: TRI.depth / 2 + TRI.bevelThickness,
  };
}

export interface TriangleProxy {
  group: Group;
  mesh: Mesh;
  /** Vértices de la línea media del marco, en espacio local: [BL, BR, TOP]. */
  centerline: [Vector3, Vector3, Vector3];
  centroid: Vector3;
  perimeterPoint: (t: number, out: Vector3, zOffset?: number) => Vector3;
  halfWidth: number;
  depthHalf: number;
  dispose: () => void;
}

/**
 * TODO: MISSING_FILL(PENROSE_FINAL_GLB) — AssetManager.load('penrose') sustituirá a createTriangleProxy()
 * manteniendo: grupo raíz 'TriangleRoot', centroide en el origen, circunradio ≈ 1.386, vértices V_TOP/V_BL/V_BR
 * y la API perimeterPoint(t).
 */
export function createTriangleProxy(material: Material, q: QualityConfig): TriangleProxy {
  const outer = roundedPath(new Shape(), equilateral(R), OUT_CORNER);
  const innerR = R - TRI.frame * 2; // inradio exterior R/2 menos el ancho del marco => circunradio = 2*(R/2 - w)
  const hole = roundedPath(new Path(), equilateral(innerR), IN_CORNER);
  outer.holes.push(hole);

  const geometry: BufferGeometry = new ExtrudeGeometry(outer, {
    depth: TRI.depth,
    bevelEnabled: true,
    bevelThickness: TRI.bevelThickness,
    bevelSize: TRI.bevelSize,
    bevelOffset: 0,
    bevelSegments: q.geometry.triangleBevelSegments,
    curveSegments: 12,
    steps: 1,
  });
  geometry.translate(0, 0, -TRI.depth / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'TriangleMesh';

  const group = new Group();
  group.name = 'TriangleRoot';
  // Orientación ligeramente isométrica aplicada al grupo (no a la geometría).
  group.rotation.set(-0.12, -0.32, 0);
  group.add(mesh);

  const rc = R / 2 - TRI.frame / 2; // inradio de la línea media del marco
  const cr = rc * 2;
  const centerline: [Vector3, Vector3, Vector3] = [
    new Vector3(-(cr * Math.sqrt(3)) / 2, -cr / 2, 0), // BL
    new Vector3((cr * Math.sqrt(3)) / 2, -cr / 2, 0), // BR
    new Vector3(0, cr, 0), // TOP
  ];

  const perimeterPoint = (t: number, out: Vector3, zOffset = 0): Vector3 => {
    const tt = ((t % 1) + 1) % 1;
    const e = Math.min(2, Math.floor(tt * 3));
    const f = tt * 3 - e;
    out.lerpVectors(centerline[e] as Vector3, centerline[(e + 1) % 3] as Vector3, f);
    out.z = zOffset;
    return out;
  };

  return {
    group, mesh, centerline, centroid: new Vector3(), perimeterPoint,
    halfWidth: TRI.frame / 2,
    depthHalf: TRI.depth / 2 + TRI.bevelThickness,
    dispose: () => geometry.dispose(),
  };
}

export const degToRad = MathUtils.degToRad;
