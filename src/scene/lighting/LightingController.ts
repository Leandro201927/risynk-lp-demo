import { Color, DirectionalLight, HemisphereLight, PCFShadowMap, PointLight, Vector3, type Scene, type WebGLRenderer } from 'three';
import type { StoryState } from '../animation/storyState';
import type { QualityConfig } from '../quality/qualityProfiles';
import { PALETTE } from '../materials/createTriangleMaterial';
import { smoothstep } from '../animation/easing';

export interface EnergyAnchors {
  need: Vector3; centroid: Vector3; top: Vector3; nozzle: Vector3;
}

/** Presupuesto fijo de 4 luces: key (sombras), fill hemisférica, rim y una luz de energía dinámica. */
export class LightingController {
  readonly key = new DirectionalLight('#ffffff', 2.2);
  readonly fill = new HemisphereLight(new Color(PALETTE.violet), new Color(PALETTE.lavender), 0.55);
  readonly rim = new DirectionalLight(new Color(PALETTE.ice), 1.2);
  readonly energy = new PointLight(new Color(PALETTE.cyan), 0, 2.5, 2);
  private tmp = new Vector3();
  private wSum = 0;

  constructor(scene: Scene, q: QualityConfig) {
    this.key.position.set(4, 6, 5);
    this.key.shadow.bias = -0.0002;
    this.key.shadow.normalBias = 0.02;
    const cam = this.key.shadow.camera;
    cam.left = -4; cam.right = 4; cam.top = 4; cam.bottom = -4; cam.near = 1; cam.far = 20;
    this.rim.position.set(-5, 3, -4);
    scene.add(this.key, this.key.target, this.fill, this.rim, this.energy);
    this.setShadows(q, null);
  }

  setShadows(q: QualityConfig, renderer: WebGLRenderer | null): void {
    const on = q.shadows.enabled;
    this.key.castShadow = on;
    if (renderer) renderer.shadowMap.enabled = on;
    if (on) {
      if (this.key.shadow.mapSize.x !== q.shadows.mapSize) {
        this.key.shadow.mapSize.set(q.shadows.mapSize, q.shadows.mapSize);
        this.key.shadow.map?.dispose();
        this.key.shadow.map = null;
      }
      this.key.shadow.radius = 4;
    }
  }

  static configureRenderer(renderer: WebGLRenderer): void {
    renderer.shadowMap.type = PCFShadowMap;
  }

  /** Posición ponderada y continua entre anclas; la intensidad deriva de StoryState (nunca salta). */
  update(s: StoryState, a: EnergyAnchors, orbitHead: Vector3 | null): void {
    const splitFade = s.splitTravel > 0 && s.splitTravel < 1 ? 1 : 0;
    const wNeed = s.needSignal * (1 - splitFade) * 0.6;
    const wCentroid = s.coreFlash * 1.0 + splitFade * 0.4;
    const wTop = s.vertexCharge * 0.9 + s.ascent * (1 - s.vertexCharge) * 0.3;
    const wNozzle = s.nozzleGlow * (0.5 + s.exhaustIntensity * 0.5);
    const total = wNeed + wCentroid + wTop + wNozzle;
    this.wSum = total;
    if (total < 1e-3) {
      this.energy.intensity = 0;
      return;
    }
    this.tmp.set(0, 0, 0);
    this.tmp.addScaledVector(a.need, wNeed).addScaledVector(a.centroid, wCentroid).addScaledVector(a.top, wTop);
    this.tmp.addScaledVector(orbitHead ?? a.nozzle, wNozzle);
    this.tmp.divideScalar(total);
    this.energy.position.copy(this.tmp);
    this.energy.intensity = 6 * Math.min(total, 1.5) * smoothstep(0, 0.15, total);
  }

  get energyLevel(): number {
    return this.wSum;
  }

  dispose(): void {
    this.key.shadow.map?.dispose();
  }
}
