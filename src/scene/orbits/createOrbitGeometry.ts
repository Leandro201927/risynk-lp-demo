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

// Entrada del cilindro en el anillo 1 y fracciones del arco B donde nacen las órbitas 2 y 3.
export const THETA_ENTRY = -0.55;
export const ARC_B_TURNS = 0.62;
const BRANCH_FRACTION = { 2: 0.1, 3: 0.3 } as const;

/**
 * Anillo 1 (Visibilidad): relativamente horizontal. Las órbitas 2 y 3 se obtienen girando el plano del anillo 1
 * alrededor del eje que pasa por el punto de ramificación: así se cruzan realmente con la órbita 1 en ese punto,
 * con inclinaciones y formas distintas (no son aros planos ni concéntricos).
 */
export function buildOrbitSpecs(): [OrbitSpec, OrbitSpec, OrbitSpec] {
  const a = 3.0, b = 2.1;
  const center = new Vector3(0, 0.35, 0);
  const q1 = new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(10), 0, MathUtils.degToRad(15), 'XYZ'));
  const orbit1: OrbitSpec = {
    id: 1, name: 'Visibilidad', a, b, quaternion: q1, center, radius: 0.024,
    color: [0.16, 0.66, 0.84], intensity: 1.0, speed: 1.0, phase: 0, branchTheta: THETA_ENTRY,
  };

  const derive = (id: 2 | 3, fraction: number, alphaDeg: number, k1: number, color: [number, number, number], radius: number, intensity: number, speed: number): OrbitSpec => {
    const th = THETA_ENTRY + fraction * ARC_B_TURNS * Math.PI * 2;
    const local = new Vector3(a * Math.cos(th), 0, b * Math.sin(th));
    const axis = local.clone().applyQuaternion(q1).normalize();
    const q = new Quaternion().setFromAxisAngle(axis, MathUtils.degToRad(alphaDeg)).multiply(q1);
    const ai = a * k1;
    const c = Math.cos(th) / k1; // (cosθ/k1)² + (sinθ/k2)² = 1  ->  k2 para que el punto pertenezca a la elipse
    const k2 = Math.abs(Math.sin(th)) / Math.sqrt(Math.max(1e-3, 1 - c * c));
    return {
      id, name: id === 2 ? 'Relaciones' : 'Resultados', a: ai, b: b * Math.min(1.35, Math.max(0.8, k2)),
      quaternion: q, center, radius, color, intensity, speed, phase: id * 0.33, branchTheta: th,
    };
  };

  return [
    orbit1,
    derive(2, BRANCH_FRACTION[2], 62, 0.92, [0.12, 0.64, 0.86], 0.021, 1.0, -0.8),
    derive(3, BRANCH_FRACTION[3], -48, 1.06, [0.05, 0.6, 0.84], 0.026, 1.3, 0.6),
  ];
}

export function createOrbitTube(spec: OrbitSpec, tubular: number, radial: number): TubeGeometry {
  return new TubeGeometry(new EllipseOrbitCurve(spec), tubular, spec.radius, radial, true);
}
