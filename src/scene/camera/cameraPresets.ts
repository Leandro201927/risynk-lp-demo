export type Vec3 = [number, number, number];

export interface CameraPreset {
  id: string;
  position: Vec3;
  target: Vec3;
  fov: number;
  focusDistance: number | 'auto';
  aperture: number; // escala del BokehPass (0 = nítido)
  roll: number; // radianes
  subjectRadius: number; // esfera que debe caber en la región de encuadre
  mobile?: Partial<Pick<CameraPreset, 'position' | 'target' | 'subjectRadius' | 'fov'>>;
}

/** Orden = índice de cameraU. Valores iniciales calibrados visualmente (ver docs/IMPLEMENTATION-LOG.md). */
export const CAMERA_PRESETS: CameraPreset[] = [
  { id: 'CAM_01_HERO_CLOSE', position: [0.75, -0.3, 1.75], target: [0.05, -0.6, 0], fov: 34, focusDistance: 'auto', aperture: 1.0, roll: -0.04, subjectRadius: 0.55 },
  { id: 'CAM_02_TRIANGLE_REVEAL', position: [3.2, 1.6, 7.4], target: [0, 0, 0], fov: 34, focusDistance: 'auto', aperture: 0.1, roll: 0, subjectRadius: 1.75 },
  { id: 'CAM_03_NEED_FOCUS', position: [-2.6, -0.2, 3.2], target: [-1.0, -0.55, 0], fov: 34, focusDistance: 'auto', aperture: 0.8, roll: 0.02, subjectRadius: 1.0 },
  { id: 'CAM_04_TRANSFORMATION_FOCUS', position: [1.0, 0.45, 3.9], target: [0, 0, 0], fov: 36, focusDistance: 'auto', aperture: 0.4, roll: 0, subjectRadius: 1.5 },
  { id: 'CAM_05_ACTIVATION_FOCUS', position: [0.9, 2.3, 4.6], target: [0, 1.6, 0], fov: 35, focusDistance: 'auto', aperture: 0.6, roll: -0.02, subjectRadius: 1.25 },
  { id: 'CAM_06_ROCKET_TRACK', position: [2.2, 2.4, 6.0], target: [1.0, 1.8, 0], fov: 36, focusDistance: 'auto', aperture: 0, roll: 0, subjectRadius: 1.2 },
  { id: 'CAM_07_ORBIT_OVERVIEW', position: [5.5, 3.4, 9.8], target: [0, 0.2, 0], fov: 36, focusDistance: 'auto', aperture: 0.05, roll: 0, subjectRadius: 3.9, mobile: { subjectRadius: 5.0 } },
  { id: 'CAM_08_FINAL_LOCK', position: [4.6, 2.6, 10.6], target: [0, 0.1, 0], fov: 35, focusDistance: 'auto', aperture: 0.05, roll: 0, subjectRadius: 3.9, mobile: { subjectRadius: 5.0 } },
];
