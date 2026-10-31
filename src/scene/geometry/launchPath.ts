import { CatmullRomCurve3, CubicBezierCurve3, DataTexture, FloatType, NearestFilter, RGBAFormat, Vector3 } from 'three';
import { ARC_B_TURNS, EllipseOrbitCurve, THETA_ENTRY, type OrbitSpec } from '../orbits/createOrbitGeometry';

export const LUT_SIZE = 512;
/** Fronteras de q (progreso narrativo) de los tramos A (lanzamiento), B (arco sobre el anillo 1) y C (escape). */
export const Q_A = 0.3;
export const Q_B = 0.86;
export const LAUNCH_SECONDS = 6;

/**
 * Trayectoria compuesta parametrizada por longitud de arco, con continuidad C1:
 *   A: Bézier desde el vértice superior hasta la entrada del anillo 1 (tangente igual a la del anillo).
 *   B: arco exacto de la elipse de la órbita 1.
 *   C: Bézier de escape, tangente a la órbita, que sale fuera de encuadre.
 */
export class LaunchPath {
  readonly points: Vector3[] = [];
  readonly cum: number[] = [];
  readonly theta: number[] = []; // θ en los puntos del tramo B (NaN fuera)
  total = 0;
  fA = 0;
  fB = 0;
  idxA = 0;
  idxB = 0;
  readonly lut: DataTexture;
  readonly trailCurve: CatmullRomCurve3;

  constructor(topWorld: Vector3, orbit1: OrbitSpec) {
    const curve = new EllipseOrbitCurve(orbit1);
    const uE = THETA_ENTRY / (Math.PI * 2);
    const E = curve.getPoint(((uE % 1) + 1) % 1);
    const tE = curve.getTangent(((uE % 1) + 1) % 1).normalize();

    const start = topWorld.clone().add(new Vector3(0.1, 0.6, 0));
    const A = new CubicBezierCurve3(
      start,
      start.clone().add(new Vector3(0.45, 1.5, -0.35)),
      E.clone().sub(tE.clone().multiplyScalar(1.7)),
      E,
    );
    const nA = 240;
    for (let i = 0; i <= nA; i++) this.push(A.getPoint(i / nA), NaN);
    this.idxA = this.points.length - 1;

    const nB = 480;
    const thetaX = THETA_ENTRY + ARC_B_TURNS * Math.PI * 2;
    for (let i = 1; i <= nB; i++) {
      const th = THETA_ENTRY + (i / nB) * ARC_B_TURNS * Math.PI * 2;
      this.push(curve.getPoint(((th / (Math.PI * 2)) % 1 + 1) % 1), th);
    }
    this.idxB = this.points.length - 1;

    const X = this.points[this.idxB] as Vector3;
    const uX = ((thetaX / (Math.PI * 2)) % 1 + 1) % 1;
    const tX = curve.getTangent(uX).normalize();
    const P3 = X.clone().add(new Vector3(-4.2, 6.2, -2.4));
    const C = new CubicBezierCurve3(
      X,
      X.clone().add(tX.clone().multiplyScalar(2.0)),
      P3.clone().sub(new Vector3(-0.6, 2.4, -0.5)),
      P3,
    );
    const nC = 240;
    for (let i = 1; i <= nC; i++) this.push(C.getPoint(i / nC), NaN);

    this.cum.length = 0;
    let acc = 0;
    for (let i = 0; i < this.points.length; i++) {
      if (i > 0) acc += (this.points[i] as Vector3).distanceTo(this.points[i - 1] as Vector3);
      this.cum.push(acc);
    }
    this.total = acc;
    this.fA = (this.cum[this.idxA] as number) / acc;
    this.fB = (this.cum[this.idxB] as number) / acc;

    // Curva del tramo A para el tubo de la estela de lanzamiento.
    const sub: Vector3[] = [];
    for (let i = 0; i <= this.idxA; i += 6) sub.push((this.points[i] as Vector3).clone());
    sub.push((this.points[this.idxA] as Vector3).clone());
    this.trailCurve = new CatmullRomCurve3(sub, false, 'centripetal');

    // LUT compartida por JS y GLSL: fila 0 = posición, fila 1 = tangente.
    const data = new Float32Array(LUT_SIZE * 2 * 4);
    const p = new Vector3(), t = new Vector3();
    for (let i = 0; i < LUT_SIZE; i++) {
      const s = i / (LUT_SIZE - 1);
      this.pointAt(s, p);
      this.tangentAt(s, t);
      data.set([p.x, p.y, p.z, 1], i * 4);
      data.set([t.x, t.y, t.z, 0], (LUT_SIZE + i) * 4);
    }
    this.lut = new DataTexture(data, LUT_SIZE, 2, RGBAFormat, FloatType);
    this.lut.minFilter = NearestFilter;
    this.lut.magFilter = NearestFilter;
    this.lut.generateMipmaps = false;
    this.lut.needsUpdate = true;
  }

  private push(p: Vector3, th: number): void {
    this.points.push(p);
    this.theta.push(th);
  }

  /** q (progreso por tramos) -> s (fracción de longitud de arco). Lineal a trozos. */
  qToS(q: number): number {
    const c = Math.max(0, Math.min(1, q));
    if (c <= Q_A) return (c / Q_A) * this.fA;
    if (c <= Q_B) return this.fA + ((c - Q_A) / (Q_B - Q_A)) * (this.fB - this.fA);
    return this.fB + ((c - Q_B) / (1 - Q_B)) * (1 - this.fB);
  }

  private locate(s: number): { i: number; f: number } {
    const target = Math.max(0, Math.min(1, s)) * this.total;
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((this.cum[mid] as number) <= target) lo = mid;
      else hi = mid;
    }
    const span = (this.cum[hi] as number) - (this.cum[lo] as number);
    return { i: lo, f: span > 1e-9 ? (target - (this.cum[lo] as number)) / span : 0 };
  }

  pointAt(s: number, out: Vector3): Vector3 {
    const { i, f } = this.locate(s);
    return out.lerpVectors(this.points[i] as Vector3, this.points[Math.min(i + 1, this.points.length - 1)] as Vector3, f);
  }

  tangentAt(s: number, out: Vector3): Vector3 {
    const { i } = this.locate(s);
    const a = this.points[Math.max(0, i - 2)] as Vector3;
    const b = this.points[Math.min(this.points.length - 1, i + 3)] as Vector3;
    return out.subVectors(b, a).normalize();
  }

  /** θ de la elipse en la cabeza del cilindro durante el tramo B (para dibujar el anillo 1). */
  thetaAt(s: number): number {
    const { i, f } = this.locate(s);
    const a = this.theta[i] as number;
    const b = this.theta[Math.min(i + 1, this.theta.length - 1)] as number;
    if (Number.isNaN(a)) return THETA_ENTRY;
    return Number.isNaN(b) ? a : a + (b - a) * f;
  }

  dispose(): void {
    this.lut.dispose();
  }
}
