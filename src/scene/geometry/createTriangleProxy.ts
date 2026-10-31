import { BufferGeometry, ExtrudeGeometry, Group, Mesh, Shape, Vector2, Vector3, type Material } from 'three';
import type { QualityConfig } from '../quality/qualityProfiles';

/**
 * Medidas (unidades de escena). Triángulo equilátero formado por TRES vigas de sección rectangular con
 * esquinas a inglete. Cada viga asciende un espesor completo a lo largo de su longitud (escalera helicoidal):
 * en cada unión una viga queda "por encima" de la siguiente y el ciclo se cierra sin cortes de material.
 * Resultado: lectura de arquitectura Penrose (solapes cíclicos) siendo geometría físicamente válida.
 */
export const TRI = {
  side: 2.4,
  frame: 0.3, // ancho de viga en el plano
  thickness: 0.22, // espesor (z) de cada viga
  rise: 0.22, // ascenso en z a lo largo de cada viga (= un espesor: el escalón apoya cara con cara)
  bevel: 0.026,
  apexFlat: 0.14, // el vértice superior se recorta para alojar la base de lanzamiento
} as const;

const R = TRI.side / Math.sqrt(3); // circunradio exterior ≈ 1.386
const R_IN = R - TRI.frame * 2;
/** Altura de la cara plana del vértice superior (y local = mundo, el grupo no rota). */
export const APEX_TOP_Y = R - TRI.apexFlat;
/** Cara interior de la viga inferior (suelo de la fachada). */
export const FLOOR_Y = -R_IN / 2;
/** Distancia en z de la cara frontal de una viga en el parámetro e∈[0,1] de su longitud. */
export const frontZ = (e: number): number => TRI.rise * (e - 0.5) + TRI.thickness / 2;

const tri = (c: number): Vector2[] => {
  const h = c / 2, half = (c * Math.sqrt(3)) / 2;
  return [new Vector2(-half, -h), new Vector2(half, -h), new Vector2(0, c)]; // BL, BR, TOP
};

export interface BeamMetrics {
  start: Vector2; // vértice de la línea media donde empieza la viga
  dir: Vector2;
  length: number;
}

export interface TriangleMetrics {
  centerline: [Vector3, Vector3, Vector3];
  beams: [BeamMetrics, BeamMetrics, BeamMetrics];
  halfWidth: number;
}

/** Medidas analíticas (sin crear geometría): inicializan uniforms de los materiales. */
export function triangleMetrics(): TriangleMetrics {
  const o = tri(R), i = tri(R_IN);
  const v = o.map((p, k) => p.clone().add(i[k]!).multiplyScalar(0.5));
  const beams = [0, 1, 2].map((k) => {
    const a = v[k]!, b = v[(k + 1) % 3]!;
    const d = b.clone().sub(a);
    const length = d.length();
    return { start: a.clone(), dir: d.divideScalar(length), length };
  }) as TriangleMetrics['beams'];
  return {
    centerline: v.map((p) => new Vector3(p.x, p.y, 0)) as TriangleMetrics['centerline'],
    beams,
    halfWidth: TRI.frame / 2,
  };
}

/** Recorte de un polígono convexo por el semiplano y <= yMax (Sutherland–Hodgman). */
function clipTop(poly: Vector2[], yMax: number): Vector2[] {
  const out: Vector2[] = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k]!, b = poly[(k + 1) % poly.length]!;
    const ia = a.y <= yMax, ib = b.y <= yMax;
    if (ia) out.push(a.clone());
    if (ia !== ib) {
      const t = (yMax - a.y) / (b.y - a.y);
      out.push(new Vector2(a.x + (b.x - a.x) * t, yMax));
    }
  }
  return out;
}

export interface TriangleProxy {
  group: Group;
  meshes: [Mesh, Mesh, Mesh];
  metrics: TriangleMetrics;
  /** Vértices de la línea media del marco: [BL, BR, TOP]. */
  centerline: [Vector3, Vector3, Vector3];
  centroid: Vector3;
  /** Punto sobre la cara frontal de la viga en el parámetro de perímetro t∈[0,1) (+ elevación sobre la cara). */
  perimeterPoint: (t: number, out: Vector3, lift?: number) => Vector3;
  dispose: () => void;
}

function buildBeam(k: number, m: TriangleMetrics, q: QualityConfig): BufferGeometry {
  const o = tri(R), inn = tri(R_IN);
  const k1 = (k + 1) % 3;
  let poly = [o[k]!, o[k1]!, inn[k1]!, inn[k]!];
  if (k >= 1) poly = clipTop(poly, APEX_TOP_Y); // vigas que tocan el vértice superior
  const shape = new Shape(poly.map((p) => p.clone()));
  const bevel = TRI.bevel;
  const g = new ExtrudeGeometry(shape, {
    depth: TRI.thickness - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel, // el contorno final coincide con el inglete exacto (uniones al ras)
    bevelSegments: q.geometry.triangleBevelSegments,
    curveSegments: 1,
    steps: 1,
  });
  g.translate(0, 0, -(TRI.thickness - bevel * 2) / 2);

  // Escalera helicoidal: cizalla en z según la posición a lo largo de la viga; normales por matriz inversa traspuesta.
  const b = m.beams[k]!;
  const s = TRI.rise / b.length;
  const pos = g.attributes.position!, nor = g.attributes.normal!;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) - b.start.x, py = pos.getY(i) - b.start.y;
    const u = (px * b.dir.x + py * b.dir.y) / b.length;
    pos.setZ(i, pos.getZ(i) + TRI.rise * (u - 0.5));
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    const ax = nx - s * b.dir.x * nz, ay = ny - s * b.dir.y * nz;
    const l = Math.hypot(ax, ay, nz) || 1;
    nor.setXYZ(i, ax / l, ay / l, nz / l);
  }
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/**
 * TODO: MISSING_FILL(PENROSE_FINAL_GLB) — AssetManager.load('penrose') sustituirá a createTriangleProxy()
 * manteniendo: grupo raíz 'TriangleRoot', centroide en el origen, circunradio ≈ 1.386, 3 vigas ordenadas BL→BR→TOP
 * y la API perimeterPoint(t).
 */
export function createTriangleProxy(materials: [Material, Material, Material], q: QualityConfig): TriangleProxy {
  const metrics = triangleMetrics();
  const group = new Group();
  group.name = 'TriangleRoot';
  const meshes = [0, 1, 2].map((k) => {
    const mesh = new Mesh(buildBeam(k, metrics, q), materials[k]!);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `TriangleBeam_${k}`;
    group.add(mesh);
    return mesh;
  }) as [Mesh, Mesh, Mesh];

  const perimeterPoint = (t: number, out: Vector3, lift = 0): Vector3 => {
    const tt = ((t % 1) + 1) % 1;
    const k = Math.min(2, Math.floor(tt * 3));
    const e = tt * 3 - k;
    const b = metrics.beams[k]!;
    out.set(b.start.x + b.dir.x * b.length * e, b.start.y + b.dir.y * b.length * e, frontZ(e) + lift);
    return out;
  };

  return {
    group, meshes, metrics, centerline: metrics.centerline, centroid: new Vector3(), perimeterPoint,
    dispose: () => meshes.forEach((m) => m.geometry.dispose()),
  };
}
