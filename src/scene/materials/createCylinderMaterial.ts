import { Color, MeshDepthMaterial, MeshPhysicalMaterial, RGBADepthPacking, ShaderMaterial, type IUniform } from 'three';
import { NOISE3 } from './shaderChunks';
import { PALETTE } from './createTriangleMaterial';

export type CylinderUniforms = Record<string, IUniform>;

export function createCylinderUniforms(): CylinderUniforms {
  return {
    uDissolve: { value: 0 },
    uNozzle: { value: 0 },
    uCyan: { value: new Color(PALETTE.cyan) },
    uAmbient: { value: 0 },
  };
}

const CYL_UNIFORMS = `uniform float uDissolve; uniform float uNozzle; uniform vec3 uCyan; uniform float uAmbient; varying vec3 vLocalPos;`;
// Materialización mecánica: la energía "construye" el cohete desde la tobera hacia la ojiva (barrido axial).
const DISSOLVE = `
float rkAx = (vLocalPos.y + 0.5);                       // 0 = tobera, 1 = punta
float rkEdge = uDissolve * 1.06 - rkAx - (rkNoise3(vLocalPos * 14.0 + 3.1) - 0.5) * 0.04;
if (rkEdge < 0.0) discard;
float rkDissolveGlow = (1.0 - smoothstep(0.0, 0.07, rkEdge)) * step(uDissolve, 0.999);
`;

const EMISSION = `
{
  float y = vLocalPos.y;
  float ring = exp(-pow((y + 0.30) / 0.008, 2.0));            // banda cian de cuerpo
  float cap = smoothstep(-0.455, -0.47, y);                   // interior de la tobera
  float tail = exp(-(y + 0.5) * 9.0) * 0.18;
  float flick = 1.0 + 0.06 * sin(uAmbient * 9.0);
  totalEmissiveRadiance += uCyan * (uNozzle * flick * (ring * 1.2 + cap * 1.8 + tail) + rkDissolveGlow * 0.9);
}`;

/** Cerámica blanca con rugosidad variable, anillo y tobera emisivos, y disolución de materialización. */
export function createCylinderMaterial(u: CylinderUniforms): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    color: new Color('#F2F2F7'),
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
    specularIntensity: 0.7,
    specularColor: new Color(PALETTE.ice),
  });
  m.customProgramCacheKey = () => 'rk-cyl-v2';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vLocalPos;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${CYL_UNIFORMS}\n${NOISE3}\nvoid main() {`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${DISSOLVE}`)
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (rkNoise3(vLocalPos * 30.0) - 0.5) * 0.06, 0.05, 1.0);`,
      )
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${EMISSION}`);
  };
  return m;
}

export function createCylinderDepthMaterial(u: CylinderUniforms): MeshDepthMaterial {
  const m = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  m.customProgramCacheKey = () => 'rk-cyl-depth-v2';
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDissolve = u.uDissolve as IUniform;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vLocalPos;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `uniform float uDissolve; varying vec3 vLocalPos;\n${NOISE3}\nvoid main() {`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (uDissolve * 1.06 - (vLocalPos.y + 0.5) - (rkNoise3(vLocalPos * 14.0 + 3.1) - 0.5) * 0.04 < 0.0) discard;`);
  };
  return m;
}

export function createCylinderBloomMaterial(u: CylinderUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: u,
    vertexShader: `varying vec3 vLocalPos;
void main() { vLocalPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${CYL_UNIFORMS}\n${NOISE3}
void main() {
  ${DISSOLVE}
  vec3 totalEmissiveRadiance = vec3(0.0);
  ${EMISSION}
  gl_FragColor = vec4(totalEmissiveRadiance, 1.0);
}`,
  });
}
