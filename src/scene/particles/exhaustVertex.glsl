uniform sampler2D uPathLUT;
uniform float uTime;           // segundos narrativos (derivados del progreso de scroll)
uniform float uLaunchProgress; // s: fracción de longitud de arco recorrida por el cilindro
uniform float uLaunchDuration;
uniform float uParticleIntensity;
uniform float uParticleCount;
uniform float uNoiseScale;
uniform float uTurbulence;
uniform float uPixelRatio;
uniform float uProjScale;
uniform float uMaxPointSize;
uniform float uNozzleOffset;
uniform float uAmbient;

attribute float aSeed;
attribute float aAge;
attribute float aLifetime;
attribute float aSize;
attribute float aVelocity;
attribute vec2 aSpread;
attribute vec3 aNoiseOffset;

varying float vLife;
varying float vSeed;
varying float vIntensity;

vec3 lutFetch(float u, int row) {
  float f = clamp(u, 0.0, 1.0) * 511.0;
  int i = int(floor(f));
  float t = f - float(i);
  vec3 a = texelFetch(uPathLUT, ivec2(i, row), 0).xyz;
  vec3 b = texelFetch(uPathLUT, ivec2(min(i + 1, 511), row), 0).xyz;
  return mix(a, b, t);
}

void main() {
  float life = aLifetime;
  // Estado puro: función solo de uTime y uLaunchProgress => determinista y reversible con el scroll.
  float phase = fract(uTime / life + aAge + aSeed);
  float age = phase * life;
  float lifeN = phase;
  float birthU = (uTime - age) / uLaunchDuration;
  float alive = step(0.0, birthU) * step(birthU, uLaunchProgress);

  vec3 emitP = lutFetch(birthU, 0);
  vec3 emitT = normalize(lutFetch(birthU, 1));
  vec3 origin = emitP - emitT * uNozzleOffset;
  vec3 axis = -emitT;

  vec3 upv = abs(axis.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 t1 = normalize(cross(upv, axis));
  vec3 t2 = cross(axis, t1);
  float th = aSpread.x * LAYER_SEMI;
  float ph = aSpread.y * 6.28318;
  vec3 lateral = t1 * cos(ph) + t2 * sin(ph);
  vec3 dir = normalize(axis * cos(th) + lateral * sin(th));

  float disp = aVelocity * (1.0 - exp(-LAYER_DRAG * age)) / LAYER_DRAG;
  vec3 p = origin + dir * disp + lateral * LAYER_RADIAL * age * (0.4 + aSeed);

  vec3 q = p * uNoiseScale + aNoiseOffset + axis * (age * 0.35);
  p += turbulence(q) * uTurbulence * LAYER_TURB * (lifeN + 0.12);

#if defined(LAYER_CORE)
  float sizeOL = mix(1.0, 0.35, lifeN);
  float fade = exp(-lifeN * 3.6);
  float flick = 1.0 + 0.1 * sin(uAmbient * 14.0 + aSeed * 40.0);
  fade *= flick;
#elif defined(LAYER_VAPOR)
  float sizeOL = mix(0.45, 2.2, smoothstep(0.0, 1.0, lifeN));
  float fade = smoothstep(0.0, 0.12, lifeN) * (1.0 - smoothstep(0.3, 1.0, lifeN));
#else
  float sizeOL = mix(1.0, 0.3, lifeN);
  float fade = pow(1.0 - lifeN, 2.0) * (0.6 + 0.4 * step(0.5, fract(aSeed * 91.7)));
#endif

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float ps = aSize * sizeOL * uProjScale / max(0.1, -mv.z);
  gl_PointSize = alive > 0.5 ? clamp(ps, 1.0, uMaxPointSize * uPixelRatio) : 0.0;
  if (alive < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);

  vLife = lifeN;
  vSeed = aSeed;
  vIntensity = fade * uParticleIntensity * alive;
}
