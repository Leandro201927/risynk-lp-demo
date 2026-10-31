/** Chunks GLSL compartidos entre material principal, material de profundidad y material de máscara de bloom. */

export const TRI_UNIFORMS = /* glsl */ `
uniform vec2 uV0; uniform vec2 uV1; uniform vec2 uV2;
uniform float uHalfW; uniform float uDepthHalf;
uniform float uReveal; uniform float uSweep; uniform float uEmission;
uniform vec3 uEdgeLit; uniform vec4 uPulses[6];
uniform float uVertexCharge; uniform float uAmbient; uniform vec3 uCyan;
varying vec3 vLocalPos;
`;

export const TRI_PERIMETER = /* glsl */ `
float rkSeg(vec2 p, vec2 a, vec2 b, out float proj, out float across) {
  vec2 ab = b - a; float L = length(ab); vec2 d = ab / L;
  float s = clamp(dot(p - a, d), 0.0, L); proj = s / L;
  vec2 q = a + d * s; vec2 n = vec2(d.y, -d.x);
  across = dot(p - a, n);
  return length(p - q);
}
void rkPerimeter(vec2 p, out float t, out float across) {
  float p0, p1, p2, a0, a1, a2;
  float d0 = rkSeg(p, uV0, uV1, p0, a0);
  float d1 = rkSeg(p, uV1, uV2, p1, a1);
  float d2 = rkSeg(p, uV2, uV0, p2, a2);
  t = p0 / 3.0; across = a0; float dm = d0;
  if (d1 < dm) { dm = d1; t = (1.0 + p1) / 3.0; across = a1; }
  if (d2 < dm) { dm = d2; t = (2.0 + p2) / 3.0; across = a2; }
}
float rkCirc(float a, float b) { float d = abs(a - b); return min(d, 1.0 - d); }
`;

/** Intensidad emisiva sobre el marco: base + aristas + pulsos + barrido + carga del vértice. */
export const TRI_ENERGY = /* glsl */ `
float rkEnergy(vec3 lp, float t, float across, out float mask) {
  float an = across / uHalfW;
  float fw = max(fwidth(an), 0.002);
  float band = 1.0 - smoothstep(0.085 - fw, 0.085 + fw, abs(an + 0.78));
  float front = smoothstep(0.55, 0.85, lp.z / uDepthHalf);
  mask = band * front;

  float e = fract(t * 2.99999); // posición dentro de la arista
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
  float sw = exp(-pow((t - sweepPos) / 0.05, 2.0)) * step(0.0001, uSweep) * (1.0 - smoothstep(0.93, 1.0, uSweep));
  float dTop = rkCirc(t, 2.0 / 3.0);
  float vc = uVertexCharge * exp(-(dTop * dTop) / 0.0045);

  float line = (uEmission + litMask * 0.9 + sw * 2.0 + vc * 1.6) * mask;
  float spill = (pulse + sw * 0.4 + vc * 0.5) * (mask * 1.0 + 0.1 * front * (1.0 - mask));
  return min(2.4, line + spill);
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
    col = mix(uColor, vec3(1.0), core);
  }
  a *= uIntensity;
  gl_FragColor = vec4(col * 1.25, a);
}
`;
