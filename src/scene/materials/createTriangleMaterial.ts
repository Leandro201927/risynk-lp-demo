import { Color, DoubleSide, MeshDepthMaterial, MeshPhysicalMaterial, RGBADepthPacking, ShaderMaterial, Vector2, Vector3, Vector4, type IUniform } from 'three';
import { LOCALPOS_VERTEX, NOISE3, TRI_ENERGY, TRI_PERIMETER, TRI_UNIFORMS } from './shaderChunks';
import type { TriangleMetrics } from '../geometry/createTriangleProxy';

export const PALETTE = {
  pearl: '#EFEFF4', cool: '#F6F6FA', lavender: '#B9B4D2', ice: '#BCEEFF', cyan: '#58DDFB', violet: '#E3DDF3',
} as const;

export type TriangleUniforms = Record<string, IUniform>;

/** Uniforms compartidos por las tres vigas (misma instancia de IUniform => una sola actualización por frame). */
export function createTriangleUniforms(): TriangleUniforms {
  return {
    uReveal: { value: 1 / 3 },
    uSweep: { value: 0 },
    uEmission: { value: 0 },
    uEdgeLit: { value: new Vector3() },
    uPulses: { value: Array.from({ length: 6 }, () => new Vector4(0, 0.03, 0, 0)) },
    uVertexCharge: { value: 0 },
    uAmbient: { value: 0 },
    uCyan: { value: new Color(PALETTE.cyan) },
    uHalfW: { value: 0.15 },
  };
}

/** Uniforms de una viga: comparte los globales y añade su arista (índice, origen, dirección, longitud). */
export function beamUniforms(shared: TriangleUniforms, m: TriangleMetrics, k: number): TriangleUniforms {
  const b = m.beams[k]!;
  return {
    ...shared,
    uBeamIdx: { value: k },
    uBStart: { value: new Vector2(b.start.x, b.start.y) },
    uBDir: { value: new Vector2(b.dir.x, b.dir.y) },
    uBLen: { value: b.length },
    uHalfW: { value: m.halfWidth },
  };
}

const VERT_INJECT = `
#include <begin_vertex>
vLocalPos = position;
vLocalNormal = normal;`;

/**
 * Cerámica nacarada: blanco opaco con velo de nácar (iridiscencia y sheen leves), sombra fría lavanda,
 * inlay cian hundido en la cara frontal de cada viga y reveal secuencial.
 */
export function createTriangleMaterial(u: TriangleUniforms): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    color: new Color(PALETTE.pearl),
    roughness: 0.34,
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.14,
    specularIntensity: 0.55,
    specularColor: new Color(PALETTE.ice),
    sheen: 0.35,
    sheenRoughness: 0.5,
    sheenColor: new Color(PALETTE.violet),
    iridescence: 0.22,
    iridescenceIOR: 1.25,
    iridescenceThicknessMinimum: 120,
    iridescenceThicknessMaximum: 380,
    envMapIntensity: 0.9,
    side: DoubleSide,
  });
  m.customProgramCacheKey = () => 'rk-tri-v2';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `varying vec3 vLocalPos;\nvarying vec3 vLocalNormal;\nvoid main() {`)
      .replace('#include <begin_vertex>', VERT_INJECT);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${TRI_UNIFORMS}\n${TRI_PERIMETER}\n${TRI_ENERGY}\n${NOISE3}\nvoid main() {`)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
float rkT, rkAcross, rkMask, rkGroove;
rkPerimeter(vLocalPos.xy, rkT, rkAcross);
float rkI = rkEnergy(vLocalPos, normalize(vLocalNormal), rkT, rkAcross, rkMask, rkGroove);
if (uReveal < 0.999 && rkT > uReveal + 0.0005) discard;
float rkBand = (uReveal < 0.999) ? smoothstep(uReveal - 0.012, uReveal, rkT) * rkMask : 0.0;
bool rkBack = !gl_FrontFacing;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// Inlay hundido: marco más oscuro y frío alrededor del cian; el interior queda casi negro-cian para que la luz se lea limpia.
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.80, 0.80, 0.90), rkGroove * 0.8);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.14, 0.18), rkMask * 0.85);
if (rkBack) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.70, 0.70, 0.80), 0.5);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (rkNoise3(vLocalPos * 22.0) - 0.5) * 0.06 - rkMask * 0.2, 0.04, 1.0);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += uCyan * (rkI * 0.9 + rkBand * 0.9);`,
      );
  };
  return m;
}

/** Profundidad para sombras: respeta el mismo discard del reveal. */
export function createTriangleDepthMaterial(u: TriangleUniforms): MeshDepthMaterial {
  const m = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  m.customProgramCacheKey = () => 'rk-tri-depth-v2';
  m.onBeforeCompile = (shader) => {
    for (const k of ['uBeamIdx', 'uBStart', 'uBDir', 'uBLen', 'uReveal'] as const) shader.uniforms[k] = u[k] as IUniform;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `varying vec3 vLocalPos;\nvoid main() {`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `uniform float uBeamIdx; uniform vec2 uBStart; uniform vec2 uBDir; uniform float uBLen; uniform float uReveal; varying vec3 vLocalPos;\n${TRI_PERIMETER.replace('float rkCirc(float a, float b) { float d = abs(a - b); return min(d, 1.0 - d); }', '')}\nvoid main() {`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
{ float t, a; rkPerimeter(vLocalPos.xy, t, a); if (uReveal < 0.999 && t > uReveal + 0.0005) discard; }`);
  };
  return m;
}

/** Máscara de bloom: solo emisión cian, el resto negro opaco (actúa de oclusor). */
export function createTriangleBloomMaterial(u: TriangleUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: u,
    side: DoubleSide,
    vertexShader: `${LOCALPOS_VERTEX}
varying vec3 vLocalNormal;
void main() { vLocalPos = position; vLocalNormal = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${TRI_UNIFORMS}\n${TRI_PERIMETER}\n${TRI_ENERGY}
void main() {
  float t, across, mask, groove;
  rkPerimeter(vLocalPos.xy, t, across);
  float I = rkEnergy(vLocalPos, normalize(vLocalNormal), t, across, mask, groove);
  if (uReveal < 0.999 && t > uReveal + 0.0005) discard;
  float band = (uReveal < 0.999) ? smoothstep(uReveal - 0.012, uReveal, t) * mask : 0.0;
  gl_FragColor = vec4(uCyan * (I * 0.9 + band * 0.9), 1.0);
}`,
  });
}
