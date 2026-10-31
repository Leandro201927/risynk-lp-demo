/**
 * Composición del bloom selectivo para un estudio high-key. El bloom aditivo puro saturaría a blanco sobre un fondo
 * claro y el halo desaparecería; aquí el halo TIÑE la imagen (resta rojo -> se lee cian) de forma localizada.
 */
export const BloomMixShader = {
  name: 'BloomMixShader',
  uniforms: {
    tDiffuse: { value: null as unknown },
    tBloom: { value: null as unknown },
    uAlphaGain: { value: 1.1 },
    uTintStrength: { value: 0.7 },
    uAdd: { value: 0.05 },
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
  // En el núcleo de los emisores el tinte multiplicativo daría azul marino: ahí se pasa a aditivo (cian luminoso).
  float core = smoothstep(0.7, 1.6, m);
  vec3 tinted = c * mix(vec3(1.0), tint, uTintStrength * (1.0 - core * 0.85));
  c = mix(c, tinted, a);
  c += b * (uAdd + core * 0.3);
  gl_FragColor = vec4(c, base.a);
}`,
};
