import { Group, LineCurve3, Mesh, TubeGeometry, Vector3, Vector4, type Object3D, type ShaderMaterial } from 'three';
import type { StoryState } from '../animation/storyState';
import { APEX_TOP_Y, type TriangleProxy } from '../geometry/createTriangleProxy';
import { STORE } from '../geometry/createStorefront';
import type { TriangleUniforms } from '../materials/createTriangleMaterial';
import { createGlowSprite, type GlowSprite } from '../materials/createGlowSprite';
import { createOrbitMaterial } from '../materials/createOrbitMaterial';
import { clamp01, smoothstep } from '../animation/easing';
import type { EnergyAnchors } from '../lighting/LightingController';

const LIFT = 0.07; // las señales flotan ligeramente por delante de la cara de la viga
/** Desfase (en progreso de st) entre el arranque de las tres señales de la escena 04: reparto ordenado, no simultáneo. */
const STAGGER = 0.14;

/**
 * Señales de energía: motes (billboards, no objetos físicos), líneas de flujo, destello de la fachada, onda de
 * halo y pulsos de perímetro que alimentan el shader de las vigas. Todo es función de StoryState.
 */
export class EnergyController {
  readonly group = new Group(); // hijo del grupo del triángulo (espacio local)
  readonly anchors: EnergyAnchors = { need: new Vector3(), centroid: new Vector3(), top: new Vector3(), nozzle: new Vector3() };
  private needMote = createGlowSprite('#58DDFB');
  private splitMotes = [createGlowSprite('#58DDFB'), createGlowSprite('#58DDFB'), createGlowSprite('#58DDFB')];
  private flash = createGlowSprite('#58DDFB');
  private charge = createGlowSprite('#58DDFB');
  private ring = createGlowSprite('#58DDFB');
  private flowLines: Array<{ mesh: Mesh; material: ShaderMaterial }> = [];
  private p = new Vector3();
  private mid = new Vector3();
  private cent = new Vector3();
  private apex = new Vector3();
  private tmp = new Vector3();

  constructor(private tri: TriangleProxy, private u: TriangleUniforms) {
    this.group.name = 'EnergySignals';
    this.cent.set(STORE.doorCenter[0], STORE.doorCenter[1], STORE.doorCenter[2] + LIFT);
    this.apex.set(0, APEX_TOP_Y + 0.1, 0.2);
    for (const s of this.sprites()) {
      s.mesh.userData.bloom = 'self';
      s.mesh.userData.noDepth = true;
      this.group.add(s.mesh);
    }
    // Líneas de flujo finas: fachada -> punto medio de cada viga (se dibujan progresivamente).
    for (let i = 0; i < 3; i++) {
      tri.perimeterPoint((i + 0.5) / 3, this.mid, LIFT);
      const g = new TubeGeometry(new LineCurve3(this.cent.clone(), this.mid.clone()), 24, 0.006, 6, false);
      const material = createOrbitMaterial(null, false);
      material.uniforms.uPulseGain!.value = 0;
      material.uniforms.uIntensity!.value = 0.8;
      const mesh = new Mesh(g, material);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.userData.bloom = 'self';
      mesh.userData.noDepth = true;
      this.group.add(mesh);
      this.flowLines.push({ mesh, material });
    }
  }

  private sprites(): GlowSprite[] {
    return [this.needMote, ...this.splitMotes, this.flash, this.charge, this.ring];
  }

  private pulse(i: number, t: number, width: number, intensity: number): void {
    (this.u.uPulses!.value as Vector4[])[i]!.set(t, width, intensity, intensity > 0.001 ? 1 : 0);
  }

  update(s: StoryState, worldOf: (o: Object3D, v: Vector3, out: Vector3) => Vector3, ambient: number): void {
    const u = this.u;
    u.uReveal!.value = s.triangleReveal;
    u.uSweep!.value = s.triangleSweep;
    u.uEmission!.value = s.triangleEmission;
    u.uVertexCharge!.value = s.vertexCharge;
    u.uAmbient!.value = ambient;

    const tri = this.tri;

    // Progreso individual de cada señal de reparto (escena 04): arranque escalonado, llegada escalonada.
    const prog = [0, 1, 2].map((i) => clamp01((s.splitTravel - STAGGER * i) / (1 - STAGGER * 2)));
    const litSplit = prog.map((p) => smoothstep(0.25, 1, p));
    (u.uEdgeLit!.value as Vector3).set(Math.max(s.edgeLit0, litSplit[0]!), litSplit[1]!, litSplit[2]!);

    // --- Pulso / mote de necesidad y pulso de retorno (mismo slot, nunca simultáneos)
    const off = 1 - smoothstep(0.75, 0.9, s.needTravel);
    const e = clamp01(s.needTravel / 0.75) * 0.5;
    const needT = e / 3;
    let slot0 = s.needSignal * 1.1 * off * (s.splitTravel > 0 ? 0 : 1);
    let slot0T = needT;
    if (s.returnPulse > 0.0001 && s.returnPulse < 0.9999) {
      slot0 = 1.6 * Math.sin(Math.PI * s.returnPulse);
      slot0T = 2 / 3 + s.returnPulse / 3;
    }
    this.pulse(0, slot0T, 0.016, slot0);

    // --- Mote de necesidad: un único punto pequeño y definido. Recorre la viga inferior y se dirige a la fachada.
    let needIntensity = s.needSignal;
    if (s.needTravel <= 0.75) tri.perimeterPoint(needT, this.p, LIFT);
    else {
      tri.perimeterPoint(0.5 / 3, this.mid, LIFT);
      const f = smoothstep(0, 1, clamp01((s.needTravel - 0.75) / 0.4));
      this.p.lerpVectors(this.mid, this.cent, f);
    }
    if (s.splitTravel > 0) needIntensity *= 1 - smoothstep(0, 0.08, s.splitTravel);
    this.needMote.mesh.position.copy(this.p);
    this.needMote.set(0.035 + 0.03 * smoothstep(0, 1, s.needSignal), needIntensity);
    this.anchors.need.copy(this.p);

    // --- Reparto (1..3): fachada -> punto medio -> vértice, escalonado
    for (let i = 0; i < 3; i++) {
      const p = prog[i]!;
      const sprite = this.splitMotes[i] as GlowSprite;
      const phase1 = clamp01(p / 0.25);
      const phase2 = clamp01((p - 0.25) / 0.75);
      tri.perimeterPoint((i + 0.5) / 3, this.mid, LIFT);
      if (p < 0.25) this.p.lerpVectors(this.cent, this.mid, smoothstep(0, 1, phase1));
      else tri.perimeterPoint((i + 0.5 + 0.5 * phase2) / 3, this.p, LIFT);
      const vis = smoothstep(0, 0.03, p) * (1 - smoothstep(0.97, 1, p));
      sprite.mesh.position.copy(this.p);
      sprite.set(0.07, vis);
      const t = (i + 0.5 + 0.5 * phase2) / 3;
      this.pulse(1 + i, t, 0.018, p >= 0.25 ? 1.3 * smoothstep(0.25, 0.32, p) * (1 - smoothstep(0.97, 1, p)) : 0);

      // Línea de flujo fachada -> viga: crece con phase1 y permanece como conexión tenue.
      const fl = this.flowLines[i]!;
      const lu = fl.material.uniforms;
      lu.uDrawLen!.value = smoothstep(0, 1, phase1);
      lu.uMaster!.value = p > 0.001 ? 0.75 : 0;
      fl.mesh.visible = p > 0.001;
    }

    // --- Ascenso por las dos vigas laterales hacia el vértice superior (convergencia real)
    const a = s.ascent;
    const asc = 1.5 * smoothstep(0, 0.08, a) * (1 - smoothstep(0.92, 1, a));
    this.pulse(4, 1 / 3 + a / 3, 0.018, asc); // BR -> TOP (viga 1)
    this.pulse(5, 1 - a / 3, 0.018, asc); // BL -> TOP (viga 2 en sentido inverso)

    // --- Destello de la fachada y carga del vértice superior
    this.flash.mesh.position.copy(this.cent);
    this.flash.set(0.12 + s.coreFlash * 0.2, s.coreFlash * 0.4);
    this.charge.mesh.position.copy(this.apex);
    this.charge.set(0.16 + Math.min(1.25, s.vertexCharge) * 0.2, Math.min(1, s.vertexCharge) * 0.6 * (1 - smoothstep(0.5, 1, s.cylinderProgress)));
    // --- Onda de luz contenida (no explosiva)
    this.ring.mesh.position.copy(this.apex);
    this.ring.set(1.15, s.haloWave > 0.001 && s.haloWave < 0.999 ? 1 : 0, s.haloWave);

    // Anclas para la luz dinámica (espacio mundo)
    worldOf(this.group, this.cent, this.anchors.centroid);
    worldOf(this.group, this.apex, this.anchors.top);
    void this.tmp;
  }

  dispose(): void {
    for (const s of this.sprites()) s.dispose();
    for (const f of this.flowLines) {
      f.mesh.geometry.dispose();
      f.material.dispose();
    }
  }
}
