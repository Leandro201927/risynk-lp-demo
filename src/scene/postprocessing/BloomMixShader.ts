/**
 * Composición del bloom selectivo para un estudio high-key. El bloom aditivo puro saturaría a blanco sobre un fondo
 * claro y el halo desaparecería; aquí el halo TIÑE la imagen (resta rojo -> se lee cian) de forma localizada.
 */
export const BloomMixShader = {
  name: 'BloomMixShader',
  uniforms: {
    tDiffuse: { value: null as unknown },
    tBloom: { value: null as unknown },
    uAlphaGain: { value: 1.4 },
    uTintStrength: { value: 0.85 },
    uAdd: { value: 0.12 },
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform sampler2D tBloom;
uniform float uAlphaGain; uniform float uTintStrength; uniform float uAdd;
varying vec2 vUv;
void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  vec3 b = texture2D(tBloom, vUv).rgb;
  float m = max(max(b.r, b.g), b.b);
  float a = clamp(m * uAlphaGain, 0.0, 1.0);
  vec3 tint = b / max(m, 1e-4);
  vec3 c = base.rgb;
  c = mix(c, c * mix(vec3(1.0), tint, uTintStrength), a);
  c += b * uAdd;
  gl_FragColor = vec4(c, base.a);
}`,
};
