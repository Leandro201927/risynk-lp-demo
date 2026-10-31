import { Color, DoubleSide, MeshDepthMaterial, MeshPhysicalMaterial, RGBADepthPacking, ShaderMaterial, Vector2, Vector3, Vector4, type IUniform } from 'three';
import { LOCALPOS_VERTEX, NOISE3, TRI_ENERGY, TRI_PERIMETER, TRI_UNIFORMS } from './shaderChunks';
import type { TriangleProxy } from '../geometry/createTriangleProxy';

export const PALETTE = {
  pearl: '#EAEAF1', cool: '#F6F6FA', lavender: '#C8C5D8', ice: '#BCEEFF', cyan: '#58DDFB', violet: '#E3DDF3',
} as const;

export type TriangleUniforms = Record<string, IUniform>;

export function createTriangleUniforms(tri: Pick<TriangleProxy, 'centerline' | 'halfWidth' | 'depthHalf'>): TriangleUniforms {
  const [bl, br, top] = tri.centerline;
  return {
    uV0: { value: new Vector2(bl.x, bl.y) },
    uV1: { value: new Vector2(br.x, br.y) },
    uV2: { value: new Vector2(top.x, top.y) },
    uHalfW: { value: tri.halfWidth },
    uDepthHalf: { value: tri.depthHalf },
    uReveal: { value: 1 / 3 },
    uSweep: { value: 0 },
    uEmission: { value: 0 },
    uEdgeLit: { value: new Vector3() },
    uPulses: { value: Array.from({ length: 6 }, () => new Vector4(0, 0.03, 0, 0)) },
    uVertexCharge: { value: 0 },
    uAmbient: { value: 0 },
    uCyan: { value: new Color(PALETTE.cyan) },
  };
}

const VERT_INJECT = `
#include <begin_vertex>
vLocalPos = position;`;

/** MeshPhysicalMaterial cerámico con extensión shader (reveal secuencial, inlay emisivo, pulsos). */
export function createTriangleMaterial(u: TriangleUniforms): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    color: new Color(PALETTE.pearl),
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.18,
    specularIntensity: 0.6,
    specularColor: new Color(PALETTE.ice),
    envMapIntensity: 1.0,
    side: DoubleSide,
  });
  m.customProgramCacheKey = () => 'rk-tri-v1';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `varying vec3 vLocalPos;\nvoid main() {`)
      .replace('#include <begin_vertex>', VERT_INJECT);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${TRI_UNIFORMS}\n${TRI_PERIMETER}\n${TRI_ENERGY}\nvoid main() {`)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
float rkT, rkAcross, rkMask;
rkPerimeter(vLocalPos.xy, rkT, rkAcross);
float rkI = rkEnergy(vLocalPos, rkT, rkAcross, rkMask);
if (uReveal < 0.999 && rkT > uReveal + 0.0005) discard;
float rkBand = (uReveal < 0.999) ? smoothstep(uReveal - 0.016, uReveal, rkT) : 0.0;
bool rkBack = !gl_FrontFacing;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.14, 0.18), rkMask * 0.85);
if (rkBack) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.65, 0.74), 0.55);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (rkHashN(vLocalPos * 22.0) - 0.5) * 0.08, 0.04, 1.0);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += uCyan * (rkI * 1.0 + rkBand * 1.2 + (rkBack ? 0.1 : 0.0));`,
      )
      .replace('void main() {', `${NOISE3}\nfloat rkHashN(vec3 p){ return rkNoise3(p); }\nvoid main() {`);
  };
  return m;
}

/** Profundidad para sombras: respeta el mismo discard del reveal. */
export function createTriangleDepthMaterial(u: TriangleUniforms): MeshDepthMaterial {
  const m = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  m.customProgramCacheKey = () => 'rk-tri-depth-v1';
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uV0 = u.uV0 as IUniform; shader.uniforms.uV1 = u.uV1 as IUniform; shader.uniforms.uV2 = u.uV2 as IUniform;
    shader.uniforms.uReveal = u.uReveal as IUniform;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `varying vec3 vLocalPos;\nvoid main() {`)
      .replace('#include <begin_vertex>', VERT_INJECT);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `uniform vec2 uV0; uniform vec2 uV1; uniform vec2 uV2; uniform float uReveal; varying vec3 vLocalPos;\n${TRI_PERIMETER}\nvoid main() {`)
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
void main() { vLocalPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${TRI_UNIFORMS}\n${TRI_PERIMETER}\n${TRI_ENERGY}
void main() {
  float t, across, mask;
  rkPerimeter(vLocalPos.xy, t, across);
  float I = rkEnergy(vLocalPos, t, across, mask);
  if (uReveal < 0.999 && t > uReveal + 0.0005) discard;
  float band = (uReveal < 0.999) ? smoothstep(uReveal - 0.016, uReveal, t) : 0.0;
  float cap = gl_FrontFacing ? 0.0 : 0.1;
  gl_FragColor = vec4(uCyan * (I + band * 1.2 + cap), 1.0);
}`,
  });
}
