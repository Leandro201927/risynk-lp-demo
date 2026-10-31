import { Color, DoubleSide, ShaderMaterial, Vector2 } from 'three';
import type { OrbitSpec } from '../orbits/createOrbitGeometry';

/**
 * Tubo emisivo para órbitas y estela de lanzamiento. Rango de dibujo circular (uDrawStart, uDrawLen),
 * pulsos gaussianos sincronizables y fresnel para dar volumen a un tubo muy fino.
 */
export function createOrbitMaterial(spec: OrbitSpec | null, closed: boolean): ShaderMaterial {
  const col = spec ? new Color().setRGB(spec.color[0], spec.color[1], spec.color[2]) : new Color(0.24, 0.78, 0.92);
  return new ShaderMaterial({
    transparent: true,
    depthWrite: true,
    side: DoubleSide,
    uniforms: {
      uColor: { value: col },
      uIce: { value: new Color('#BCEEFF') },
      uIntensity: { value: spec?.intensity ?? 1 },
      uMaster: { value: 0 },
      uDrawStart: { value: 0 },
      uDrawLen: { value: 0 },
      uClosed: { value: closed ? 1 : 0 },
      uPulsePhase: { value: 0 },
      uPulseGain: { value: 1 },
      uConnect: { value: 0 },
      uConnectU: { value: new Vector2(0.1, 0.5) },
      uFlash: { value: [new Vector2(0, 0), new Vector2(0, 0)] },
      uFade: { value: 0 },
      uAmbient: { value: 0 },
    },
    vertexShader: /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor; uniform vec3 uIce; uniform float uIntensity; uniform float uMaster;
uniform float uDrawStart; uniform float uDrawLen; uniform float uClosed;
uniform float uPulsePhase; uniform float uPulseGain; uniform float uConnect; uniform vec2 uConnectU;
uniform vec2 uFlash[2]; uniform float uFade; uniform float uAmbient;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float circ(float a, float b) { float d = abs(a - b); return min(d, 1.0 - d); }
void main() {
  float u = vUv.x;
  float d = uClosed > 0.5 ? mod(u - uDrawStart + 1.0, 1.0) : (u - uDrawStart);
  float len = uDrawLen;
  if (len <= 0.0001 || d < 0.0 || d > len) discard;
  float head = (len < 0.999) ? smoothstep(len - 0.05, len, d) : 0.0;
  float tail = (len < 0.999) ? smoothstep(0.0, 0.03, d) : 1.0;
  float frac = (u - uDrawStart) / max(uDrawLen, 0.0001);
  // Estela de lanzamiento: se disuelve desde el vértice hacia la órbita (uFade 0 -> 1).
  float vanish = uClosed > 0.5 ? 1.0 : clamp((frac - uFade * 1.1) * 8.0 + 1.0, 0.0, 1.0) * (1.0 - smoothstep(0.95, 1.0, uFade));
  float fres = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 1.6);
  float pulse = 0.0;
  for (int i = 0; i < 3; i++) {
    float pu = fract(uPulsePhase + float(i) / 3.0);
    float dd = circ(u, pu);
    pulse += exp(-(dd * dd) / 0.0009);
  }
  float conn = 0.0;
  conn += exp(-pow(circ(u, uConnectU.x) / 0.05, 2.0));
  conn += exp(-pow(circ(u, uConnectU.y) / 0.05, 2.0));
  float flash = exp(-pow(circ(u, uFlash[0].x) / 0.03, 2.0)) * uFlash[0].y + exp(-pow(circ(u, uFlash[1].x) / 0.03, 2.0)) * uFlash[1].y;
  float I = uIntensity * (0.95 + pulse * 0.9 * uPulseGain + head * 0.9 + conn * uConnect * 1.1 + flash * 1.6);
  I *= 1.0 + 0.04 * sin(uAmbient * 5.0 + u * 20.0);
  vec3 col = mix(uColor * I, uIce * (0.85 + 0.4 * pulse), fres * 0.55);
  float alpha = uMaster * tail * vanish;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col, alpha);
}`,
  });
}
