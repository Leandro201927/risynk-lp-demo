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
const DISSOLVE = `
float rkN = rkNoise3(vLocalPos * 9.0 + 3.1);
float rkEdge = uDissolve * 1.12 - rkN;
if (rkEdge < 0.0) discard;
float rkDissolveGlow = 1.0 - smoothstep(0.0, 0.09, rkEdge);
`;

/** Cerámica blanca con rugosidad variable, anillo y tobera emisivos, y disolución de materialización. */
export function createCylinderMaterial(u: CylinderUniforms): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    color: new Color(PALETTE.cool),
    roughness: 0.28,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
    specularIntensity: 0.7,
    specularColor: new Color(PALETTE.ice),
  });
  m.customProgramCacheKey = () => 'rk-cyl-v1';
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
roughnessFactor = clamp(roughnessFactor + 0.06 * sin(vLocalPos.y * 38.0) + (rkNoise3(vLocalPos * 30.0) - 0.5) * 0.08, 0.05, 1.0);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  float y = vLocalPos.y;
  float ring = exp(-pow((y + 0.39) / 0.012, 2.0));
  float cap = smoothstep(-0.443, -0.449, y);
  float tail = exp(-(y + 0.45) * 7.0) * 0.28;
  float flick = 1.0 + 0.08 * sin(uAmbient * 9.0);
  totalEmissiveRadiance += uCyan * (uNozzle * flick * (ring * 1.7 + cap * 2.2 + tail) + rkDissolveGlow * 1.5);
}`,
      );
  };
  return m;
}

export function createCylinderDepthMaterial(u: CylinderUniforms): MeshDepthMaterial {
  const m = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  m.customProgramCacheKey = () => 'rk-cyl-depth-v1';
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDissolve = u.uDissolve as IUniform;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vLocalPos;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `uniform float uDissolve; varying vec3 vLocalPos;\n${NOISE3}\nvoid main() {`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (uDissolve * 1.12 - rkNoise3(vLocalPos * 9.0 + 3.1) < 0.0) discard;`);
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
  float y = vLocalPos.y;
  float ring = exp(-pow((y + 0.39) / 0.012, 2.0));
  float cap = smoothstep(-0.443, -0.449, y);
  float tail = exp(-(y + 0.45) * 7.0) * 0.28;
  float flick = 1.0 + 0.08 * sin(uAmbient * 9.0);
  gl_FragColor = vec4(uCyan * (uNozzle * flick * (ring * 1.7 + cap * 2.2 + tail) + rkDissolveGlow * 1.5), 1.0);
}`,
  });
}
