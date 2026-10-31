import { Group, Vector3, Vector4, type Object3D } from 'three';
import type { StoryState } from '../animation/storyState';
import type { TriangleProxy } from '../geometry/createTriangleProxy';
import type { TriangleUniforms } from '../materials/createTriangleMaterial';
import { createGlowSprite, type GlowSprite } from '../materials/createGlowSprite';
import { clamp01, smoothstep } from '../animation/easing';
import type { EnergyAnchors } from '../lighting/LightingController';

const FACE_Z = 0.22; // las señales flotan ligeramente por delante de la cara frontal

/**
 * Señales de energía: motes de luz (billboards, no objetos físicos), destello central, onda de halo
 * y pulsos de perímetro que alimentan el shader del triángulo. Todo es función de StoryState.
 */
export class EnergyController {
  readonly group = new Group(); // hijo del grupo del triángulo (espacio local)
  readonly anchors: EnergyAnchors = { need: new Vector3(), centroid: new Vector3(), top: new Vector3(), nozzle: new Vector3() };
  private needMote = createGlowSprite('#58DDFB');
  private splitMotes = [createGlowSprite('#58DDFB'), createGlowSprite('#58DDFB'), createGlowSprite('#58DDFB')];
  private flash = createGlowSprite('#7FE6FF');
  private charge = createGlowSprite('#58DDFB');
  private ring = createGlowSprite('#58DDFB');
  private p = new Vector3();
  private mid = new Vector3();
  private cent = new Vector3();
  private a = new Vector3();
  private b = new Vector3();

  constructor(private tri: TriangleProxy, private u: TriangleUniforms) {
    this.group.name = 'EnergySignals';
    this.cent.set(0, 0, FACE_Z);
    for (const s of this.sprites()) {
      s.mesh.userData.bloom = 'self';
      this.group.add(s.mesh);
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
    (u.uEdgeLit!.value as Vector3).set(s.edgeLit0, s.edgeLit1, s.edgeLit2);
    u.uVertexCharge!.value = s.vertexCharge;
    u.uAmbient!.value = ambient;

    const tri = this.tri;
    const centerline = tri.centerline;

    // --- Pulso / mote de necesidad (0) y pulso de retorno (mismo slot, nunca simultáneos)
    const off = 1 - smoothstep(0.75, 0.9, s.needTravel);
    const e = clamp01(s.needTravel / 0.75) * 0.5;
    const needT = e / 3;
    let slot0 = s.needSignal * 1.5 * off * (s.splitTravel > 0 ? 0 : 1);
    let slot0T = needT;
    if (s.returnPulse > 0.0001 && s.returnPulse < 0.9999) {
      slot0 = 2.0 * Math.sin(Math.PI * s.returnPulse);
      slot0T = 2 / 3 + s.returnPulse / 3;
    }
    this.pulse(0, slot0T, 0.022, slot0);

    // --- Motes de necesidad
    let needIntensity = s.needSignal;
    if (s.needTravel <= 0.75) tri.perimeterPoint(needT, this.p, FACE_Z);
    else {
      tri.perimeterPoint(0.5 / 3, this.mid, FACE_Z);
      const f = smoothstep(0, 1, clamp01((s.needTravel - 0.75) / 0.4));
      this.p.lerpVectors(this.mid, this.cent, f);
    }
    if (s.splitTravel > 0) needIntensity *= 1 - smoothstep(0, 0.08, s.splitTravel);
    this.needMote.mesh.position.copy(this.p);
    this.needMote.set(0.05 + 0.15 * smoothstep(0, 1, s.needSignal), needIntensity);
    this.anchors.need.copy(this.p);

    // --- Señales de transformación (1..3): centroide -> punto medio -> vértice, sincronizadas
    for (let i = 0; i < 3; i++) {
      const st = s.splitTravel;
      const sprite = this.splitMotes[i] as GlowSprite;
      const phase1 = clamp01(st / 0.25);
      const phase2 = clamp01((st - 0.25) / 0.75);
      tri.perimeterPoint((i + 0.5) / 3, this.mid, FACE_Z);
      if (st < 0.25) this.p.lerpVectors(this.cent, this.mid, smoothstep(0, 1, phase1));
      else tri.perimeterPoint((i + 0.5 + 0.5 * phase2) / 3, this.p, FACE_Z);
      const vis = smoothstep(0, 0.03, st) * (1 - smoothstep(0.97, 1, st));
      sprite.mesh.position.copy(this.p);
      sprite.set(0.13, vis);
      const t = (i + 0.5 + 0.5 * phase2) / 3;
      this.pulse(1 + i, t, 0.026, st >= 0.25 ? 1.7 * smoothstep(0.25, 0.32, st) * (1 - smoothstep(0.97, 1, st)) : 0);
    }

    // --- Ascenso por las dos aristas laterales hacia el vértice superior
    const a = s.ascent;
    const asc = 1.9 * smoothstep(0, 0.08, a) * (1 - smoothstep(0.92, 1, a));
    this.pulse(4, 1 / 3 + a / 3, 0.026, asc);
    this.pulse(5, 1 - a / 3, 0.026, asc);

    // --- Destello central y carga del vértice superior
    this.flash.mesh.position.copy(this.cent);
    this.flash.set(0.2 + s.coreFlash * 1.0, s.coreFlash * 0.9);
    const top = centerline[2] as Vector3;
    this.charge.mesh.position.set(top.x, top.y, FACE_Z);
    this.charge.set(0.22 + Math.min(1.25, s.vertexCharge) * 0.5, Math.min(1, s.vertexCharge) * 0.85 * (1 - smoothstep(0.5, 1, s.cylinderProgress)));
    // --- Onda de luz controlada (no explosiva)
    this.ring.mesh.position.set(top.x, top.y, FACE_Z);
    this.ring.set(1.9, s.haloWave > 0.001 && s.haloWave < 0.999 ? 1 : 0, s.haloWave);

    // Anclas para la luz dinámica (espacio mundo)
    worldOf(this.group, this.cent, this.anchors.centroid);
    this.a.set(top.x, top.y, FACE_Z);
    worldOf(this.group, this.a, this.anchors.top);
    this.b.copy(this.cent);
  }

  dispose(): void {
    for (const s of this.sprites()) s.dispose();
  }
}
