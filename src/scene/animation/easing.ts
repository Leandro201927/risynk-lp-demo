export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Hermite cúbica monótona por nudos (τ, q, pendiente). Pendiente inicial 0, luego acelera y se estabiliza. */
const KNOTS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [7 / 17, 0.3, 1.0],
  [15 / 17, 0.86, 1.19],
  [1, 1, 1.19],
];

/**
 * Easing del lanzamiento: τ (0..1 sobre 73%→90%) -> q (progreso por tramos).
 * q(τ=7/17)=0.30 y q(τ=15/17)=0.86: coinciden con las fronteras A/B/C del recorrido.
 * Velocidad C1 continua: aceleración inicial, desplazamiento rápido, crucero.
 */
export function launchEase(tau: number): number {
  const t = clamp01(tau);
  for (let i = 0; i < KNOTS.length - 1; i++) {
    const a = KNOTS[i] as readonly [number, number, number];
    const b = KNOTS[i + 1] as readonly [number, number, number];
    if (t <= b[0] || i === KNOTS.length - 2) {
      const h = b[0] - a[0];
      const u = clamp01((t - a[0]) / h);
      const u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * a[1] + (u3 - 2 * u2 + u) * h * a[2] + (-2 * u3 + 3 * u2) * b[1] + (u3 - u2) * h * b[2];
    }
  }
  return 1;
}
