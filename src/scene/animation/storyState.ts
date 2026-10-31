/**
 * Estado narrativo único. Todo es un número plano para que GSAP lo interpole directamente.
 * Cada campo es función exclusiva del progreso de scroll (timeline determinista y reversible).
 */
export interface StoryState {
  progress: number; // 0..1
  chapter: number; // 0..5 (derivado)
  // Cámara
  cameraU: number; // 0..6 índice continuo entre los planos de SHOTS (interpolación orbital, sin spline)
  cameraTrack: number; // mezcla preset <-> seguimiento del cilindro
  cameraLift: number;
  dofAmount: number;
  introDolly: number; // canal aditivo de la entrada de carga (basado en tiempo, vuelve a 0)
  // Triángulo
  triangleReveal: number;
  triangleSweep: number;
  triangleEmission: number;
  edgeLit0: number; // arista inferior iluminada durante la escena 03 (las demás se derivan de splitTravel)
  vertexCharge: number;
  haloWave: number;
  gtaoBlend: number;
  // Energía
  needSignal: number;
  needTravel: number;
  coreFlash: number;
  storeEnergy: number; // tinte cian de la zona de luz de la fachada
  splitTravel: number;
  ascent: number;
  returnPulse: number;
  // Cilindro
  cylinderVisibility: number;
  cylinderAlign: number;
  cylinderProgress: number; // q: 0..1 sobre los tres tramos (A/B/C)
  nozzleGlow: number;
  // Escape
  exhaustProgress: number; // derivado: segundos narrativos
  exhaustIntensity: number;
  // Órbitas
  orbitFormation0: number; // cierre del anillo 1 tras el tramo B
  orbitFormation1: number;
  orbitFormation2: number;
  launchTrailFade: number;
  orbitPhase: number;
  orbitSynchronization: number;
  orbitIntensity: number;
  orbitConnect: number;
}

export type StoryNumericKey = Exclude<keyof StoryState, never>;

export function createInitialStoryState(): StoryState {
  return {
    progress: 0, chapter: 0,
    cameraU: 0, cameraTrack: 0, cameraLift: 0, dofAmount: 1, introDolly: 0,
    triangleReveal: 1 / 3, triangleSweep: 0, triangleEmission: 0,
    edgeLit0: 0, vertexCharge: 0, haloWave: 0, gtaoBlend: 0,
    needSignal: 0, needTravel: 0, coreFlash: 0, storeEnergy: 0, splitTravel: 0, ascent: 0, returnPulse: 0,
    cylinderVisibility: 0, cylinderAlign: 0, cylinderProgress: 0, nozzleGlow: 0,
    exhaustProgress: 0, exhaustIntensity: 0,
    orbitFormation0: 0, orbitFormation1: 0, orbitFormation2: 0, launchTrailFade: 0,
    orbitPhase: 0, orbitSynchronization: 0, orbitIntensity: 0, orbitConnect: 0,
  };
}

/** Hash numérico barato para detectar si el estado cambió (render dirty-aware). */
export function hashState(s: StoryState): number {
  let h = 0;
  const values = Object.values(s) as number[];
  for (let i = 0; i < values.length; i++) h = (h * 31 + (values[i] as number) * 1000.123 * (i + 1)) % 1e9;
  return h;
}

/** Ángulo final de giro compartido de los tres anillos (rad). Usado por timeline y OrbitController. */
export const ORBIT_PHASE_FINAL = 1.1;
