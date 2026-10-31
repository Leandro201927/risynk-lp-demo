import { BufferAttribute, BufferGeometry, Color, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, Points, ShaderMaterial, Sphere, Vector3, type Object3D } from 'three';
import type { QualityConfig } from '../quality/qualityProfiles';
import { LAUNCH_SECONDS, type LaunchPath } from '../geometry/launchPath';
import noiseGlsl from './noise.glsl?raw';
import vertexGlsl from './exhaustVertex.glsl?raw';
import fragmentGlsl from './exhaustFragment.glsl?raw';

type Layer = 'core' | 'vapor' | 'sparks';

interface LayerSpec {
  life: [number, number]; vel: [number, number]; size: [number, number]; sizeSkew: number;
  semi: number; drag: number; radial: number; turb: number; fall: number; alpha: number; colorRate: number;
  colorA: string; colorB: string;
}

// Paleta: núcleo blanco→cian; vapor lavanda/gris frío (legible sobre #f2f2f4); chispas cian→azul hielo.
const SPEC: Record<Layer, LayerSpec> = {
  core: { life: [0.35, 0.6], vel: [2.4, 3.2], size: [0.035, 0.09], sizeSkew: 2.2, semi: 0.07, drag: 4.0, radial: 0.02, turb: 0.12, fall: 5.5, alpha: 1.1, colorRate: 1.6, colorA: '#F6F6FA', colorB: '#58DDFB' },
  vapor: { life: [1.2, 2.8], vel: [0.8, 1.6], size: [0.14, 0.4], sizeSkew: 1.8, semi: 0.26, drag: 2.2, radial: 0.14, turb: 0.5, fall: 2.8, alpha: 0.085, colorRate: 1.0, colorA: '#C2BEDA', colorB: '#DDD8EF' },
  sparks: { life: [0.4, 1.0], vel: [1.5, 3.5], size: [0.012, 0.035], sizeSkew: 1.5, semi: 0.5, drag: 1.2, radial: 0.05, turb: 0.3, fall: 7.0, alpha: 1.0, colorRate: 1.2, colorA: '#2CC4E8', colorB: '#9BE9FF' },
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGeometry(layer: Layer, count: number, seed: number, bounds: Sphere): BufferGeometry {
  const s = SPEC[layer];
  const rnd = mulberry32(seed);
  const g = new BufferGeometry();
  const aSeed = new Float32Array(count), aAge = new Float32Array(count), aLifetime = new Float32Array(count);
  const aSize = new Float32Array(count), aVelocity = new Float32Array(count), aSpread = new Float32Array(count * 2);
  const aNoise = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    aSeed[i] = rnd();
    aAge[i] = rnd();
    aLifetime[i] = s.life[0] + rnd() * (s.life[1] - s.life[0]);
    aSize[i] = s.size[0] + Math.pow(rnd(), s.sizeSkew) * (s.size[1] - s.size[0]);
    aVelocity[i] = s.vel[0] + rnd() * (s.vel[1] - s.vel[0]);
    aSpread[i * 2] = Math.sqrt(rnd());
    aSpread[i * 2 + 1] = rnd();
    aNoise[i * 3] = rnd() * 100; aNoise[i * 3 + 1] = rnd() * 100; aNoise[i * 3 + 2] = rnd() * 100;
  }
  g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3)); // requerido por three; no se usa
  g.setAttribute('aSeed', new BufferAttribute(aSeed, 1));
  g.setAttribute('aAge', new BufferAttribute(aAge, 1));
  g.setAttribute('aLifetime', new BufferAttribute(aLifetime, 1));
  g.setAttribute('aSize', new BufferAttribute(aSize, 1));
  g.setAttribute('aVelocity', new BufferAttribute(aVelocity, 1));
  g.setAttribute('aSpread', new BufferAttribute(aSpread, 2));
  g.setAttribute('aNoiseOffset', new BufferAttribute(aNoise, 3));
  g.boundingSphere = bounds.clone();
  return g;
}

export interface ExhaustParams {
  time: number; // segundos narrativos
  launchProgress: number; // s
  intensity: number;
  turbulence: number;
  ambient: number;
  pixelRatio: number;
  projScale: number;
}

/**
 * Escape del cilindro en GPU: tres capas (Exhaust Core / Vapor / Energy Sparks).
 * Sin estado: cada partícula se calcula a partir del progreso narrativo, así que el scroll inverso la deshace.
 */
export class ExhaustSystem {
  readonly root: Object3D & { children: Object3D[] };
  private layers: Array<{ layer: Layer; points: Points; material: ShaderMaterial }> = [];
  private bounds = new Sphere();

  constructor(private path: LaunchPath, q: QualityConfig, root: Object3D & { children: Object3D[] }) {
    this.root = root;
    const box = new Vector3();
    path.pointAt(0.5, box);
    this.bounds.set(box, path.total * 0.7);
    this.build(q);
  }

  private defines(layer: Layer, q: QualityConfig): Record<string, string | number | boolean> {
    const s = SPEC[layer];
    const d: Record<string, string | number | boolean> = {
      [`LAYER_${layer.toUpperCase()}`]: 1,
      LAYER_SEMI: s.semi.toFixed(4), LAYER_DRAG: s.drag.toFixed(3), LAYER_RADIAL: s.radial.toFixed(4), LAYER_TURB: s.turb.toFixed(4),
      LAYER_FALL: s.fall.toFixed(3), LAYER_ALPHA: s.alpha.toFixed(3), LAYER_COLOR_RATE: s.colorRate.toFixed(3),
      NOISE_OCTAVES: q.particles.octaves,
    };
    if (q.particles.curl) d.USE_CURL = 1;
    if (q.particles.vaporErosion) d.VAPOR_EROSION = 1;
    return d;
  }

  private build(q: QualityConfig): void {
    (['vapor', 'core', 'sparks'] as Layer[]).forEach((layer, idx) => {
      const count = q.particles[layer === 'vapor' ? 'vapor' : layer === 'core' ? 'core' : 'sparks'];
      const s = SPEC[layer];
      const material = new ShaderMaterial({
        defines: this.defines(layer, q),
        transparent: true,
        depthWrite: false,
        depthTest: true,
        vertexShader: `${noiseGlsl}\n${vertexGlsl}`,
        fragmentShader: fragmentGlsl,
        uniforms: {
          uPathLUT: { value: this.path.lut },
          uTime: { value: 0 }, uLaunchProgress: { value: 0 }, uLaunchDuration: { value: LAUNCH_SECONDS },
          uParticleIntensity: { value: 0 }, uParticleCount: { value: count },
          uNoiseScale: { value: layer === 'vapor' ? 0.9 : 1.6 }, uTurbulence: { value: 1 },
          uPixelRatio: { value: 1 }, uProjScale: { value: 800 }, uMaxPointSize: { value: q.particles.maxPointSize },
          uNozzleOffset: { value: 0.45 }, uAmbient: { value: 0 },
          uColorA: { value: new Color(s.colorA) }, uColorB: { value: new Color(s.colorB) },
        },
      });
      if (layer === 'core') {
        material.blending = CustomBlending;
        material.blendSrc = OneFactor;
        material.blendDst = OneFactor;
      } else {
        material.blending = CustomBlending;
        material.blendSrc = OneFactor;
        material.blendDst = OneMinusSrcAlphaFactor;
      }
      const points = new Points(buildGeometry(layer, count, 1337 + idx * 101, this.bounds), material);
      points.frustumCulled = false;
      points.renderOrder = layer === 'vapor' ? 3 : 4;
      points.name = `Exhaust_${layer}`;
      // Bloom selectivo: núcleo y chispas emiten; el vapor no entra en la máscara.
      points.userData.bloom = layer === 'vapor' ? 'hide' : 'self';
      this.root.add(points);
      this.layers.push({ layer, points, material });
    });
  }

  rebuild(q: QualityConfig): void {
    this.disposeLayers();
    this.build(q);
  }

  update(p: ExhaustParams): void {
    for (const l of this.layers) {
      const u = l.material.uniforms;
      u.uTime!.value = p.time;
      u.uLaunchProgress!.value = p.launchProgress;
      u.uParticleIntensity!.value = p.intensity;
      u.uTurbulence!.value = p.turbulence;
      u.uAmbient!.value = p.ambient;
      u.uPixelRatio!.value = p.pixelRatio;
      u.uProjScale!.value = p.projScale;
      l.points.visible = p.intensity > 0.002;
    }
  }

  private disposeLayers(): void {
    for (const l of this.layers) {
      this.root.remove(l.points);
      l.points.geometry.dispose();
      l.material.dispose();
    }
    this.layers = [];
  }

  dispose(): void {
    this.disposeLayers();
  }
}
