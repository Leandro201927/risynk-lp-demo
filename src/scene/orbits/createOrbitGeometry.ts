import { Curve, Euler, MathUtils, Quaternion, TubeGeometry, Vector3 } from 'three';

export interface OrbitSpec {
  id: 1 | 2 | 3;
  name: 'Visibilidad' | 'Relaciones' | 'Resultados';
  a: number; // radio principal
  b: number; // radio secundario
  quaternion: Quaternion;
  center: Vector3;
  radius: number; // grosor del tubo
  color: [number, number, number];
  intensity: number;
  speed: number; // velocidad relativa de rotación
  phase: number;
  branchTheta: number; // θ (rad) donde la órbita se cruza con la órbita 1
}

/** Elipse en un plano 3D arbitrario. Parametrizada por ángulo (no por arco) para que uv.x = θ/2π. */
export class EllipseOrbitCurve extends Curve<Vector3> {
  constructor(readonly spec: OrbitSpec) {
    super();
  }
  override getPoint(t: number, target = new Vector3()): Vector3 {
    const th = t * Math.PI * 2;
    return target
      .set(this.spec.a * Math.cos(th), 0, this.spec.b * Math.sin(th))
      .applyQuaternion(this.spec.quaternion)
      .add(this.spec.center);
  }
  override getPointAt(u: number, target = new Vector3()): Vector3 {
    return this.getPoint(u, target);
  }
  override getTangentAt(u: number, target = new Vector3()): Vector3 {
    return this.getTangent(u, target);
  }
}

// Entrada del cohete en el anillo 1 y fracción del arco B donde nacen las órbitas 2 y 3 (mismo punto de ramificación).
export const THETA_ENTRY = -0.7;
export const ARC_B_TURNS = 0.62;
const BRANCH_FRACTION = 0.12;
const BRANCH_ANGLE_DEG = 60;

/**
 * Sistema giroscópico de tres elipses idénticas en forma y distintas en plano:
 *  - Anillo 1 (Visibilidad): relativamente horizontal, ligeramente inclinado hacia la derecha.
 *  - Anillos 2 y 3 (Relaciones, Resultados): el plano del anillo 1 girado ±60° alrededor del eje que pasa por el
 *    punto de ramificación. Son imágenes especulares respecto al plano 1: tres planos a 60° entre sí que comparten
 *    exactamente dos nodos (el punto de ramificación y su antípoda). Sin cruces arbitrarios.
 * Todas son más grandes que el triángulo (b > circunradio), de modo que el núcleo queda siempre visible y libre.
 */
export function buildOrbitSpecs(): [OrbitSpec, OrbitSpec, OrbitSpec] {
  const a = 2.4, b = 1.85;
  const center = new Vector3(0, 0.2, 0);
  const q1 = new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(12), 0, MathUtils.degToRad(22), 'XYZ'));
  const orbit1: OrbitSpec = {
    id: 1, name: 'Visibilidad', a, b, quaternion: q1, center, radius: 0.021,
    color: [0.16, 0.66, 0.84], intensity: 1.0, speed: 1.0, phase: 0, branchTheta: THETA_ENTRY,
  };

  const th = THETA_ENTRY + BRANCH_FRACTION * ARC_B_TURNS * Math.PI * 2;
  const axis = new Vector3(a * Math.cos(th), 0, b * Math.sin(th)).applyQuaternion(q1).normalize();
  const derive = (id: 2 | 3, sign: 1 | -1, color: [number, number, number], radius: number, intensity: number, speed: number): OrbitSpec => ({
    id, name: id === 2 ? 'Relaciones' : 'Resultados', a, b,
    quaternion: new Quaternion().setFromAxisAngle(axis, MathUtils.degToRad(BRANCH_ANGLE_DEG * sign)).multiply(q1),
    center, radius, color, intensity, speed, phase: id * 0.33, branchTheta: th,
  });

  return [
    orbit1,
    derive(2, 1, [0.12, 0.64, 0.86], 0.018, 0.95, -0.8),
    derive(3, -1, [0.05, 0.6, 0.84], 0.018, 1.0, 0.6),
  ];
}

export function createOrbitTube(spec: OrbitSpec, tubular: number, radial: number): TubeGeometry {
  return new TubeGeometry(new EllipseOrbitCurve(spec), tubular, spec.radius, radial, true);
}
