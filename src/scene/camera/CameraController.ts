import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { REF_DESKTOP, REF_MOBILE, SHOTS, TRACK_POSE, type ShotPose } from './cameraPresets';
import type { StoryState } from '../animation/storyState';
import type { LaunchPath } from '../geometry/launchPath';
import { lerp } from '../animation/easing';

export interface FramingRegion {
  /** Desplazamiento NDC horizontal del centro del sujeto (0 = centro del canvas). */
  ndcShiftX: number;
  /** Fracción del ancho del canvas disponible para el sujeto (1 = completo). */
  widthFraction: number;
  /** Fracción del alto ocupada por la barra de navegación fija (el sujeto se centra en el resto). */
  topInsetFraction: number;
}

interface Pose {
  tx: number; ty: number; tz: number;
  az: number; el: number; logDist: number; fov: number; roll: number; aperture: number;
}

const D2R = Math.PI / 180;

function toPose(p: ShotPose): Pose {
  return {
    tx: p.target[0], ty: p.target[1], tz: p.target[2], az: p.azimuth, el: p.elevation,
    logDist: Math.log(p.distance), fov: p.fov, roll: p.roll, aperture: p.aperture,
  };
}

function mixPose(a: Pose, b: Pose, f: number, out: Pose): Pose {
  out.tx = lerp(a.tx, b.tx, f); out.ty = lerp(a.ty, b.ty, f); out.tz = lerp(a.tz, b.tz, f);
  out.az = lerp(a.az, b.az, f); out.el = lerp(a.el, b.el, f);
  out.logDist = lerp(a.logDist, b.logDist, f); out.fov = lerp(a.fov, b.fov, f);
  out.roll = lerp(a.roll, b.roll, f); out.aperture = lerp(a.aperture, b.aperture, f);
  return out;
}

/**
 * Cámara cinematográfica.
 *  1) CINEMATIC FRAMING: poses autoradas por plano (cameraPresets.SHOTS), interpoladas en espacio orbital
 *     (target lineal, azimut/elevación lineales, distancia en log). Sin spline, sin esfera envolvente genérica.
 *  2) RESPONSIVE SAFE FRAMING: solo AMPLÍA la distancia cuando el viewport real es más estrecho que el de referencia
 *     para el que se autoró el plano (relación de semiángulos). Nunca acerca ni redefine el plano.
 *  3) Punto principal (filmOffset): centra el sujeto en la región libre de texto.
 */
export class CameraController {
  readonly camera = new PerspectiveCamera(34, 1, 0.1, 100);
  private shots: Pose[] = [];
  private track!: Pose;
  private mobile = false;
  region: FramingRegion = { ndcShiftX: 0, widthFraction: 1, topInsetFraction: 0 };
  focusDistance = 5;
  aperture = 0;
  /** 0 = escena a la derecha, 1 = escena a la izquierda (transición suave entre capítulos). */
  layoutMix = 0;
  /** Factor responsive aplicado en el último frame (1 = plano autorado intacto). Útil para depuración. */
  responsiveFactor = 1;
  private pose: Pose = toPose(SHOTS[0]!.pose);
  private poseB: Pose = toPose(SHOTS[0]!.pose);
  private poseT: Pose = toPose(SHOTS[0]!.pose);
  private tgt = new Vector3();
  private trackTarget = new Vector3();
  private lagged = new Vector3();
  private coreTarget = new Vector3();

  constructor(private path: LaunchPath) {
    this.camera.filmGauge = 35;
    this.rebuild(false);
  }

  /** Escritorio y móvil usan composiciones autoradas distintas (no un recorte de la misma). */
  rebuild(mobile: boolean): void {
    this.mobile = mobile;
    this.shots = SHOTS.map((s) => toPose({ ...s.pose, ...(mobile ? s.mobile : {}) }));
    this.track = toPose({ ...TRACK_POSE.desktop, ...(mobile ? TRACK_POSE.mobile : {}) });
  }

  get isMobile(): boolean {
    return this.mobile;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
  }

  /** Semiángulo limitante (el menor entre el vertical y el horizontal de la región) para un FOV dado. */
  private limitingHalfAngle(fov: number, aspect: number, regionFraction: number, heightFraction: number): number {
    const vHalf = Math.atan(Math.tan(fov * D2R * 0.5) * heightFraction);
    const hHalf = Math.atan(Math.tan(fov * D2R * 0.5) * aspect * regionFraction);
    return Math.max(0.05, Math.min(vHalf, hHalf));
  }

  /** RESPONSIVE SAFE FRAMING: factor >= 1 que preserva la fracción de encuadre del plano de referencia. */
  private responsiveDistanceFactor(fov: number): number {
    const ref = this.mobile ? REF_MOBILE : REF_DESKTOP;
    const actual = this.limitingHalfAngle(fov, this.camera.aspect, this.region.widthFraction, 1 - this.region.topInsetFraction);
    const reference = this.limitingHalfAngle(fov, ref.aspect, ref.regionFraction, ref.heightFraction);
    return Math.max(1, Math.sin(reference) / Math.sin(actual));
  }

  update(s: StoryState, nowSec: number): void {
    const last = this.shots.length - 1;
    const u = MathUtils.clamp(s.cameraU, 0, last);
    const i = Math.min(last - 1, Math.floor(u));
    const f = u - i;
    const base = mixPose(this.shots[i]!, this.shots[i + 1]!, f, this.poseB);

    let pose = base;
    if (s.cameraTrack > 0.0001) {
      // Seguimiento del cohete: mismo espacio orbital que los planos, así la mezcla nunca teletransporta.
      const sHead = this.path.qToS(s.cylinderProgress);
      this.path.pointAt(Math.max(0, sHead - 0.01), this.trackTarget);
      this.lagged.copy(this.trackTarget).lerp(this.coreTarget.set(...TRACK_POSE.core), TRACK_POSE.coreBias);
      const t = this.track;
      this.poseT.tx = this.lagged.x; this.poseT.ty = this.lagged.y; this.poseT.tz = this.lagged.z;
      this.poseT.az = t.az; this.poseT.el = t.el; this.poseT.logDist = t.logDist;
      this.poseT.fov = t.fov; this.poseT.roll = t.roll; this.poseT.aperture = t.aperture;
      pose = mixPose(base, this.poseT, MathUtils.smootherstep(s.cameraTrack, 0, 1), this.pose);
    } else {
      Object.assign(this.pose, base);
      pose = this.pose;
    }

    this.responsiveFactor = this.responsiveDistanceFactor(pose.fov);
    // introDolly: asentamiento mínimo de la entrada de carga (≤ 5 %), basado en tiempo y reversible.
    const dist = Math.exp(pose.logDist) * this.responsiveFactor * (1 + s.introDolly * 0.05);
    this.tgt.set(pose.tx, pose.ty, pose.tz);
    // Al cambiar de lado la cámara también se refleja: la escena gira hacia el texto.
    const az = pose.az * (1 - 2 * this.layoutMix) * D2R, el = pose.el * D2R;
    const cosEl = Math.cos(el);
    this.camera.position.set(
      this.tgt.x + dist * cosEl * Math.sin(az),
      this.tgt.y + dist * Math.sin(el) + s.cameraLift * 0.12,
      this.tgt.z + dist * cosEl * Math.cos(az),
    );
    this.camera.up.set(Math.sin(pose.roll), Math.cos(pose.roll), 0);
    this.camera.fov = pose.fov;
    this.camera.lookAt(this.tgt);

    // Punto principal: desplaza el sujeto hacia la derecha (región libre de texto) sin recortar el canvas.
    const vHalf = pose.fov * D2R * 0.5;
    const shift = this.region.ndcShiftX;
    this.camera.filmOffset = -shift * this.camera.aspect * Math.tan(vHalf) * this.camera.getFilmWidth();
    // Zona segura superior: centra verticalmente el sujeto en el área bajo la barra de navegación.
    const inset = this.region.topInsetFraction;
    // setViewOffset fija aspect = fullWidth/fullHeight: se pasan dimensiones con la proporción REAL (con 1×1 la escena se estiraba).
    const A = this.camera.aspect, H = 1000;
    if (inset > 0.001) this.camera.setViewOffset(A * H, H, 0, (-inset / 2) * H, A * H, H);
    else this.camera.clearViewOffset();
    this.camera.aspect = A;
    this.camera.updateProjectionMatrix();

    this.focusDistance = this.camera.position.distanceTo(this.tgt);
    this.aperture = pose.aperture * s.dofAmount;
    void nowSec;
  }
}
