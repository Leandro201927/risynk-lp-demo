import { Color } from 'three';

// Port de AgXToneMapping (three/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js).
// Las matrices GLSL son column-major; aquí se guardan como filas.
const cols = (a: number[], b: number[], c: number[]): number[][] => [0, 1, 2].map((r) => [a[r] as number, b[r] as number, c[r] as number]);
const SRGB_TO_2020 = cols([0.6274, 0.0691, 0.0164], [0.3293, 0.9195, 0.088], [0.0433, 0.0113, 0.8956]);
const INSET = cols([0.856627153315983, 0.137318972929847, 0.11189821299995], [0.0951212405381588, 0.761241990602591, 0.0767994186031903], [0.0482516061458583, 0.101439036467562, 0.811302368396859]);
const OUTSET = cols([1.1271005818144368, -0.1413297634984383, -0.14132976349843826], [-0.11060664309660323, 1.157823702216272, -0.11060664309660294], [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405]);
const R2020_TO_SRGB = cols([1.6605, -0.1246, -0.0182], [-0.5876, 1.1329, -0.1006], [-0.0728, -0.0083, 1.1187]);
const MIN_EV = -12.47393, MAX_EV = 4.026069;

const mul = (m: number[][], v: number[]): number[] => m.map((row) => (row[0] as number) * (v[0] as number) + (row[1] as number) * (v[1] as number) + (row[2] as number) * (v[2] as number));

function contrast(x: number): number {
  const x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

export function agx(rgb: number[], exposure: number): number[] {
  let c = rgb.map((v) => v * exposure);
  c = mul(INSET, mul(SRGB_TO_2020, c));
  c = c.map((v) => Math.min(1, Math.max(0, (Math.log2(Math.max(v, 1e-10)) - MIN_EV) / (MAX_EV - MIN_EV))));
  c = c.map(contrast);
  c = mul(OUTSET, c).map((v) => Math.pow(Math.max(0, v), 2.2));
  return mul(R2020_TO_SRGB, c).map((v) => Math.min(1, Math.max(0, v)));
}

/**
 * Color lineal de fondo tal que, tras AgX + sRGB (OutputPass), el canvas coincida con el color de la página.
 * Resolución por punto fijo por canal con derivada numérica (AgX es monótona).
 */
export function solveBackground(targetHex: string, exposure: number): Color {
  const target = new Color(targetHex); // lineal (ColorManagement activo)
  const t = [target.r, target.g, target.b];
  const x = [2, 2, 2];
  for (let it = 0; it < 80; it++) {
    const f = agx(x, exposure);
    for (let c = 0; c < 3; c++) {
      const probe = x.slice();
      probe[c] = (probe[c] as number) * 1.01 + 1e-4;
      const fp = agx(probe, exposure);
      const slope = ((fp[c] as number) - (f[c] as number)) / ((probe[c] as number) - (x[c] as number));
      const err = (t[c] as number) - (f[c] as number);
      x[c] = Math.max(1e-4, (x[c] as number) + err / Math.max(slope, 1e-3) * 0.8);
    }
  }
  return new Color(x[0] as number, x[1] as number, x[2] as number);
}
