import { CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, TubeGeometry, Vector2, Vector3 } from 'three';
import { LOGO_COUNT, createLogoTexture } from './createLogoTextures';
import type { StoryState } from '../animation/storyState';
import { ORBIT_PHASE_FINAL } from '../animation/storyState';
import { ARC_B_TURNS, EllipseOrbitCurve, THETA_ENTRY, buildOrbitSpecs, createOrbitTube, type OrbitSpec } from './createOrbitGeometry';
import { createOrbitMaterial } from '../materials/createOrbitMaterial';
import { Q_A, Q_B, type LaunchPath } from '../geometry/launchPath';
import { clamp01, lerp, smoothstep } from '../animation/easing';
import type { QualityConfig } from '../quality/qualityProfiles';
import type { ShaderMaterial } from 'three';
import { INTEGRATIONS_BY_ORBIT, IntegrationTokenFactory, type IntegrationToken } from './createIntegrationTokens';

const TAU = Math.PI * 2;
const wrap01 = (x: number): number => ((x % 1) + 1) % 1;

interface OrbitItem {
  spec: OrbitSpec;
  group: Group;
  mesh: Mesh;
  material: ShaderMaterial;
  branchU: number;
  logos: LogoItem[];
}

interface LogoItem {
  mesh: Mesh;
  u: number; // posición base sobre la órbita (0..1)
  drift: number; // desplazamiento angular por segundo (fracción de vuelta)
  spin: number; // giro sobre su propio eje (rad/s)
}

const LOGOS_PER_ORBIT = 3;
const LOGO_SIZE = 0.34;

/** Anillos 3D (Visibilidad / Relaciones / Resultados) + tubo de la estela de lanzamiento. Todo determinista. */
export class OrbitController {
  readonly root = new Group();
  readonly specs = buildOrbitSpecs();
  private items: OrbitItem[] = [];
  private trail!: Mesh;
  private trailMaterial!: ShaderMaterial;
  private curves: EllipseOrbitCurve[] = [];
  private factory = new IntegrationTokenFactory();
  private connectU: Array<[number, number]> = [[0.1, 0.5], [0.1, 0.5], [0.1, 0.5]];

  constructor(private path: LaunchPath, q: QualityConfig, triangleVerticesWorld: Vector3[]) {
    this.root.name = 'Orbits';
    this.build(q);
    this.computeConnections(triangleVerticesWorld);
  }

  private build(q: QualityConfig): void {
    // TODO: MISSING_FILL(ORBIT_NODE_MODELS) — los nodos se posicionarán por el parámetro u de cada órbita (sin cubos ni marcadores en el piloto).
    this.curves = this.specs.map((sp) => new EllipseOrbitCurve(sp));
    for (const spec of this.specs) {
      const material = createOrbitMaterial(spec, true);
      const mesh = new Mesh(createOrbitTube(spec, q.geometry.orbitTubular, q.geometry.orbitRadial), material);
      mesh.frustumCulled = false;
      mesh.userData.bloom = 'self';
      mesh.name = `Orbit_${spec.name}`;
      const group = new Group();
      group.add(mesh);
      const logos: LogoItem[] = [];
      for (let k = 0; k < LOGOS_PER_ORBIT; k++) {
        const idx = (spec.id - 1) * LOGOS_PER_ORBIT + k;
        const mat = new MeshBasicMaterial({ map: createLogoTexture(idx % LOGO_COUNT), transparent: true, side: DoubleSide, toneMapped: false, depthWrite: false });
        const logo = new Mesh(new CircleGeometry(LOGO_SIZE / 2, 48), mat);
        logo.frustumCulled = false;
        logo.visible = false;
        logo.name = `Logo_${spec.name}_${k}`;
        group.add(logo);
        logos.push({ mesh: logo, u: (k + spec.phase) / LOGOS_PER_ORBIT, drift: 0.012 * Math.sign(spec.speed || 1), spin: 1.4 + 0.3 * k });
      }
      this.root.add(group);
      this.items.push({ spec, group, mesh, material, branchU: wrap01(spec.branchTheta / TAU), logos });
    }
    this.trailMaterial = createOrbitMaterial(null, false);
    this.trail = new Mesh(new TubeGeometry(this.path.trailCurve, 180, 0.012, 8, false), this.trailMaterial);
    this.trail.frustumCulled = false;
    this.trail.userData.bloom = 'self';
    this.trail.name = 'LaunchTrail';
    this.root.add(this.trail);
  }

  /** Parámetro u de máxima proximidad a los vértices del triángulo, con la rotación final de los anillos. */
  private computeConnections(verts: Vector3[]): void {
    const v = new Vector3();
    this.items.forEach((it, i) => {
      const curve = new EllipseOrbitCurve(it.spec);
      const best: Array<{ d: number; u: number }> = verts.map(() => ({ d: Infinity, u: 0 }));
      for (let k = 0; k < 720; k++) {
        const u = k / 720;
        curve.getPoint(u, v).applyAxisAngle(new Vector3(0, 1, 0), ORBIT_PHASE_FINAL);
        verts.forEach((w, j) => {
          const d = v.distanceTo(w);
          if (d < (best[j] as { d: number }).d) best[j] = { d, u };
        });
      }
      best.sort((a, b) => a.d - b.d);
      this.connectU[i] = [(best[0] as { u: number }).u, (best[1] as { u: number }).u];
    });
  }

  rebuild(q: QualityConfig): void {
    this.disposeMeshes();
    this.build(q);
  }

  update(s: StoryState, ambient: number): void {
    const path = this.path;
    const sHead = path.qToS(s.cylinderProgress);
    const u0 = wrap01(THETA_ENTRY / TAU);
    const sync = s.orbitSynchronization;
    const phi = s.orbitPhase;

    // Órbita 1: la estela se convierte en el anillo (cabeza = cilindro durante el tramo B), luego se cierra.
    const it1 = this.items[0] as OrbitItem;
    let lenBase = 0;
    if (s.cylinderProgress > Q_A) {
      const thetaHead = path.thetaAt(Math.min(sHead, path.fB));
      lenBase = s.cylinderProgress >= Q_B ? ARC_B_TURNS : clamp01((thetaHead - THETA_ENTRY) / TAU);
    }
    const close = s.orbitFormation0;
    const closing = 1 - ARC_B_TURNS;
    const u1 = it1.material.uniforms;
    u1.uDrawStart!.value = wrap01(u0 - (closing / 2) * close);
    u1.uDrawLen!.value = Math.min(1, lenBase + closing * close);
    u1.uMaster!.value = s.orbitIntensity;

    // Destellos en la órbita 1 cuando nacen las órbitas 2 y 3 (continuidad visual del punto de ramificación)
    const bump = (f: number): number => smoothstep(0, 0.12, f) * (1 - smoothstep(0.12, 0.4, f));
    const fl = u1.uFlash!.value as Vector2[];
    (fl[0] as Vector2).set((this.items[1] as OrbitItem).branchU, bump(s.orbitFormation1));
    (fl[1] as Vector2).set((this.items[2] as OrbitItem).branchU, bump(s.orbitFormation2));

    const formation = [close, s.orbitFormation1, s.orbitFormation2];
    this.items.forEach((it, i) => {
      const m = it.material.uniforms;
      if (i > 0) {
        const f = formation[i] as number;
        m.uDrawStart!.value = wrap01(it.branchU - f / 2);
        m.uDrawLen!.value = f;
        m.uMaster!.value = f > 0.001 ? 1 : 0;
      }
      // Rotación coordinada: velocidades distintas que convergen (sync 0->1) al mismo ángulo.
      it.group.rotation.y = phi + (it.spec.speed - 1) * phi * (1 - sync);
      const freePhase = phi * (1.2 + 0.5 * i) + i * 0.37;
      m.uPulsePhase!.value = lerp(freePhase, phi * 1.4, sync) + ambient * 0.05;
      m.uPulseGain!.value = 1;
      m.uConnect!.value = s.orbitConnect;
      (m.uConnectU!.value as Vector2).set((this.connectU[i] as [number, number])[0], (this.connectU[i] as [number, number])[1]);
      m.uAmbient!.value = ambient;
      it.mesh.visible = (m.uMaster!.value as number) > 0.001;

      // Logos de integraciones: viajan sobre la órbita ya dibujada y giran sobre su propio eje.
      const appear = smoothstep(0.75, 1, formation[i] as number) * clamp01(s.orbitIntensity * 1.5 + (i > 0 ? 1 : 0));
      for (const lg of it.logos) {
        lg.mesh.visible = appear > 0.01;
        if (!lg.mesh.visible) continue;
        this.curves[i]!.getPoint(wrap01(lg.u + lg.drift * ambient), lg.mesh.position);
        lg.mesh.rotation.set(0, ambient * lg.spin, 0);
        lg.mesh.scale.setScalar(0.4 + 0.6 * appear);
        (lg.mesh.material as MeshBasicMaterial).opacity = appear;
      }
    });

    // Tubo de estela del tramo A
    const t = this.trailMaterial.uniforms;
    const headU = clamp01(sHead / path.fA);
    t.uDrawStart!.value = 0;
    t.uDrawLen!.value = s.cylinderProgress > 0.001 ? headU : 0;
    t.uMaster!.value = s.cylinderProgress > 0.001 ? 1 : 0;
    t.uFade!.value = s.launchTrailFade;
    t.uPulseGain!.value = 0.5;
    t.uPulsePhase!.value = phi + s.cylinderProgress * 3.0;
    t.uAmbient!.value = ambient;
    this.trail.visible = s.cylinderProgress > 0.001 && s.launchTrailFade < 0.999;
  }

  /** Posición mundo del extremo dibujado del anillo 1 (para la luz de energía). */
  private disposeMeshes(): void {
    for (const it of this.items) {
      this.root.remove(it.group);
      it.mesh.geometry.dispose();
      it.material.dispose();
      for (const lg of it.logos) {
        lg.mesh.geometry.dispose();
        const mat = lg.mesh.material as MeshBasicMaterial;
        mat.map?.dispose();
        mat.dispose();
      }
    }
    this.items = [];
    this.root.remove(this.trail);
    this.trail.geometry.dispose();
    this.trailMaterial.dispose();
  }

  dispose(): void {
    this.disposeMeshes();
    this.factory.dispose();
  }
}
