/** Chunks GLSL compartidos entre material principal, material de profundidad y material de máscara de bloom. */

export const TRI_UNIFORMS = /* glsl */ `
uniform float uBeamIdx; uniform vec2 uBStart; uniform vec2 uBDir; uniform float uBLen;
uniform float uHalfW;
uniform float uReveal; uniform float uSweep; uniform float uEmission;
uniform vec3 uEdgeLit; uniform vec4 uPulses[6];
uniform float uVertexCharge; uniform float uAmbient; uniform vec3 uCyan;
varying vec3 vLocalPos; varying vec3 vLocalNormal;
`;

/** Parámetro de perímetro EXACTO por viga: cada mesh conoce su arista (índice, origen, dirección, longitud). */
export const TRI_PERIMETER = /* glsl */ `
void rkPerimeter(vec2 p, out float t, out float across) {
  vec2 r = p - uBStart;
  float e = clamp(dot(r, uBDir) / uBLen, 0.0, 1.0);
  across = dot(r, vec2(uBDir.y, -uBDir.x));
  t = (uBeamIdx + e) / 3.0;
}
float rkCirc(float a, float b) { float d = abs(a - b); return min(d, 1.0 - d); }
`;

/**
 * Intensidad emisiva: inlay hundido en la cara frontal de cada viga. Base tenue + arista iluminada + pulsos +
 * barrido + carga del vértice. El máximo está limitado para que el cian nunca queme la cerámica.
 */
export const TRI_ENERGY = /* glsl */ `
float rkEnergy(vec3 lp, vec3 ln, float t, float across, out float mask, out float groove) {
  float an = across / uHalfW;
  float fw = max(fwidth(an), 0.002);
  float aa = abs(an);
  float front = smoothstep(0.8, 0.95, ln.z);
  mask = (1.0 - smoothstep(0.075 - fw, 0.075 + fw, aa)) * front;
  groove = (1.0 - smoothstep(0.15 - fw, 0.15 + fw, aa)) * front; // marco del inlay (se oscurece el albedo)

  float e = fract(t * 2.99999);
  int edge = int(floor(t * 2.99999));
  float lit = edge == 0 ? uEdgeLit.x : (edge == 1 ? uEdgeLit.y : uEdgeLit.z);
  float litMask = (1.0 - smoothstep(lit * 0.5 - 0.03, lit * 0.5 + 0.03, abs(e - 0.5))) * smoothstep(0.0, 0.02, lit);

  float pulse = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 pu = uPulses[i];
    float d = rkCirc(t, pu.x);
    pulse += pu.z * exp(-(d * d) / (pu.y * pu.y));
  }
  float sweepPos = uSweep * 1.12 - 0.06;
  float sw = exp(-pow((t - sweepPos) / 0.04, 2.0)) * step(0.0001, uSweep) * (1.0 - smoothstep(0.93, 1.0, uSweep));
  float dTop = rkCirc(t, 2.0 / 3.0);
  float vc = uVertexCharge * exp(-(dTop * dTop) / 0.0035);

  float line = (uEmission + litMask * 0.7 + sw * 1.5 + vc * 1.2) * mask;
  // La luz se derrama muy poco sobre la cerámica vecina: localizada en el inlay.
  float spill = (pulse + sw * 0.25 + vc * 0.35) * (mask + 0.07 * groove * (1.0 - mask));
  return min(1.8, line + spill);
}
`;

export const NOISE3 = /* glsl */ `
float rkHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float rkNoise3(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rkHash(i), rkHash(i + vec3(1,0,0)), f.x), mix(rkHash(i + vec3(0,1,0)), rkHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(rkHash(i + vec3(0,0,1)), rkHash(i + vec3(1,0,1)), f.x), mix(rkHash(i + vec3(0,1,1)), rkHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

export const LOCALPOS_VERTEX = /* glsl */ `
varying vec3 vLocalPos;
`;

/** Billboard con halo para motes de energía y ondas. */
export const GLOW_VERTEX = /* glsl */ `
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}
`;

export const GLOW_FRAGMENT = /* glsl */ `
uniform vec3 uColor; uniform float uIntensity; uniform float uRing; uniform float uTime;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  if (r > 1.0) discard;
  float a;
  vec3 col;
  if (uRing > 0.0) {
    float rr = uRing;
    float w = 0.06 + 0.12 * rr;
    a = exp(-pow((r - rr) / w, 2.0)) * (1.0 - rr);
    col = mix(vec3(1.0), uColor, 0.75);
  } else {
    float core = exp(-r * r * 22.0);
    float halo = exp(-r * r * 4.5);
    a = clamp(core + halo * 0.55, 0.0, 1.0);
    col = mix(uColor, vec3(1.0), core * 0.4);
  }
  a *= uIntensity;
  gl_FragColor = vec4(col * 1.25, a);
}
`;
