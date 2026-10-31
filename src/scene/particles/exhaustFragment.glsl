uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vLife;
varying float vSeed;
varying float vIntensity;

float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  // Caída radial suave: nunca un sprite cuadrado.
  float fall = exp(-r * r * LAYER_FALL);
#if defined(LAYER_VAPOR) && defined(VAPOR_EROSION)
  float n = vnoise(gl_PointCoord * 3.2 + vSeed * 17.0) * 0.65 + vnoise(gl_PointCoord * 7.0 + vSeed * 5.0) * 0.35;
  fall *= smoothstep(0.12, 0.62, n + (1.0 - r) * 0.6);
#endif
  vec3 col = mix(uColorA, uColorB, clamp(vLife * LAYER_COLOR_RATE, 0.0, 1.0));
  float a = fall * vIntensity * LAYER_ALPHA;
  if (a < 0.003) discard;
#if defined(LAYER_CORE)
  // Aditivo (One, One): núcleo blanco-cian incandescente.
  gl_FragColor = vec4(col * a, 1.0);
#else
  // Alpha premultiplicado (One, OneMinusSrcAlpha).
  gl_FragColor = vec4(col * a, a);
#endif
}
