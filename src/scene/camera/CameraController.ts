import { CatmullRomCurve3, PerspectiveCamera, Vector3 } from 'three';
import { CAMERA_PRESETS, type CameraPreset } from './cameraPresets';
import type { StoryState } from '../animation/storyState';
import type { LaunchPath } from '../geometry/launchPath';
import { lerp } from '../animation/easing';

export interface FramingRegion {
  /** Desplazamiento NDC horizontal del centro del sujeto (0 = centro del canvas). */
  ndcShiftX: number;
  /** Fracción del ancho del canvas disponible para el sujeto (1 = completo). */
  widthFraction: number;
}

/**
 * Cámara cinematográfica: spline Catmull-Rom centrípeta (C1) por los presets, seguimiento del cilindro,
 * encuadre responsive por esfera del sujeto y desplazamiento del punto principal (filmOffset).
 */
export class CameraController {
  readonly camera = new PerspectiveCamera(34, 1, 0.1, 100);
  private posCurve!: CatmullRomCurve3;
  private tgtCurve!: CatmullRomCurve3;
  private lensCurve!: CatmullRomCurve3; // x=fov y=aperture z=roll
  private radiusCurve!: CatmullRomCurve3;
  private presets: CameraPreset[] = CAMERA_PRESETS;
  private mobile = false;
  region: FramingRegion = { ndcShiftX: 0, widthFraction: 1 };
  focusDistance = 5;
  aperture = 0;
  private pos = new Vector3();
  private tgt = new Vector3();
  private dir = new Vector3();
  private trackTarget = new Vector3();
  private trackPos = new Vector3();
  private tmp = new Vector3();
  private tan = new Vector3();

  constructor(private path: LaunchPath) {
    this.camera.filmGauge = 35;
    this.rebuild(false);
  }

  /** Reconstruye las curvas (escritorio vs móvil usan presets distintos, no un recorte). */
  rebuild(mobile: boolean): void {
    this.mobile = mobile;
    const pick = (p: CameraPreset) => ({ ...p, ...(mobile ? p.mobile : {}) });
    const ps = this.presets.map(pick);
    const v = (a: number[]) => new Vector3(a[0], a[1], a[2]);
    this.posCurve = new CatmullRomCurve3(ps.map((p) => v(p.position)), false, 'centripetal');
    this.tgtCurve = new CatmullRomCurve3(ps.map((p) => v(p.target)), false, 'centripetal');
    this.lensCurve = new CatmullRomCurve3(ps.map((p) => new Vector3(p.fov, p.aperture, p.roll)), false, 'centripetal');
    this.radiusCurve = new CatmullRomCurve3(ps.map((p) => new Vector3(p.subjectRadius, 0, 0)), false, 'centripetal');
  }

  get isMobile(): boolean {
    return this.mobile;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
  }

  update(s: StoryState, nowSec: number): void {
    const u = Math.min(7, Math.max(0, s.cameraU)) / 7;
    // getPoint (no getPointAt): u*7 coincide exactamente con el índice de preset.
    this.posCurve.getPoint(u, this.pos);
    this.tgtCurve.getPoint(u, this.tgt);
    const lens = this.lensCurve.getPoint(u, this.tmp);
    let fov = lens.x, aperture = lens.y, roll = lens.z;
    const radius = this.radiusCurve.getPoint(u, new Vector3()).x;

    // Seguimiento del cilindro (CAM_06): el target se retrasa ligeramente sobre la cabeza.
    if (s.cameraTrack > 0.0001) {
      const sHead = this.path.qToS(s.cylinderProgress);
      this.path.pointAt(Math.max(0, sHead - 0.012), this.trackTarget);
      this.path.tangentAt(sHead, this.tan);
      const ang = -0.9 * Math.min(1, sHead / this.path.fB);
      const ox = 2.6, oy = 1.2, oz = 4.4;
      this.trackPos.set(this.trackTarget.x + ox * Math.cos(ang) + oz * Math.sin(ang), this.trackTarget.y + oy, this.trackTarget.z - ox * Math.sin(ang) + oz * Math.cos(ang));
      this.pos.lerp(this.trackPos, s.cameraTrack);
      this.tgt.lerp(this.trackTarget, s.cameraTrack);
      aperture = lerp(aperture, 0, s.cameraTrack);
    }

    // Distancia mínima para que la esfera del sujeto quepa en la región de encuadre (responsive, sin clipping).
    this.dir.subVectors(this.pos, this.tgt);
    const d0 = this.dir.length();
    this.dir.divideScalar(Math.max(d0, 1e-5));
    const vHalf = (fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect * this.region.widthFraction);
    const need = (radius * (s.cameraTrack > 0.0001 ? 1.0 : 1.0)) / Math.sin(Math.max(0.05, Math.min(vHalf, hHalf)));
    const dist = Math.max(d0, need) - s.introDolly * 0.25;
    this.pos.copy(this.tgt).addScaledVector(this.dir, dist);
    this.pos.y += s.cameraLift * 0.35;

    this.camera.position.copy(this.pos);
    this.camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    this.camera.fov = fov;
    this.camera.lookAt(this.tgt);

    // Punto principal: desplaza el sujeto hacia la derecha (región libre de texto) sin recortar el canvas.
    const shift = this.region.ndcShiftX;
    this.camera.filmOffset = -shift * this.camera.aspect * Math.tan(vHalf) * this.camera.getFilmWidth();
    this.camera.updateProjectionMatrix();

    this.focusDistance = this.camera.position.distanceTo(this.tgt);
    this.aperture = aperture * s.dofAmount;
    void nowSec;
  }
}
