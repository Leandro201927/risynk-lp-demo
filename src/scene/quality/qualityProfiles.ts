export type TierId = 'REALTIME_SAFE' | 'REALTIME_LOW' | 'REALTIME_MEDIUM' | 'REALTIME_HIGH';

export interface QualityConfig {
  id: TierId;
  tier: 0 | 1 | 2 | 3;
  backend: 'webgl2'; // Fase 1: WebGL 2. TODO(Fase 2): 'webgpu' vía WebGPURenderer + TSL
  pixelRatioCap: number;
  renderScale: number;
  msaa: 0 | 4;
  shadows: { enabled: boolean; mapSize: number; contactBlob: boolean };
  gtao: { enabled: boolean; samples: number; intensity: number };
  ssr: { enabled: boolean };
  bloom: { strength: number; radius: number; resolutionScale: number };
  dof: { enabled: boolean; apertureScale: number; maxBlur: number };
  smaa: boolean;
  particles: {
    core: number; vapor: number; sparks: number; maxPointSize: number;
    octaves: 1 | 2 | 3 | 4; curl: boolean; vaporErosion: boolean;
  };
  geometry: { triangleBevelSegments: number; cylinderRadialSegments: number; orbitTubular: number; orbitRadial: number };
  idleFps: number;
}

/** Registro central. Todos los perfiles apuntan a la MISMA escena (LiveSceneBackend): solo cambia qualityConfig. */
export const QUALITY_PROFILES: Record<TierId, QualityConfig> = {
  REALTIME_SAFE: {
    id: 'REALTIME_SAFE', tier: 0, backend: 'webgl2', pixelRatioCap: 1, renderScale: 0.75, msaa: 0,
    shadows: { enabled: false, mapSize: 512, contactBlob: true },
    gtao: { enabled: false, samples: 0, intensity: 0 }, ssr: { enabled: false },
    bloom: { strength: 0.25, radius: 0.45, resolutionScale: 0.35 },
    dof: { enabled: false, apertureScale: 0, maxBlur: 0 }, smaa: true,
    particles: { core: 1500, vapor: 700, sparks: 700, maxPointSize: 64, octaves: 1, curl: false, vaporErosion: false },
    geometry: { triangleBevelSegments: 3, cylinderRadialSegments: 48, orbitTubular: 256, orbitRadial: 6 },
    idleFps: 20,
  },
  REALTIME_LOW: {
    id: 'REALTIME_LOW', tier: 1, backend: 'webgl2', pixelRatioCap: 1.25, renderScale: 0.9, msaa: 0,
    shadows: { enabled: true, mapSize: 1024, contactBlob: false },
    gtao: { enabled: false, samples: 0, intensity: 0 }, ssr: { enabled: false },
    bloom: { strength: 0.3, radius: 0.5, resolutionScale: 0.5 },
    dof: { enabled: false, apertureScale: 0, maxBlur: 0 }, smaa: true,
    particles: { core: 3000, vapor: 1400, sparks: 1400, maxPointSize: 96, octaves: 2, curl: false, vaporErosion: false },
    geometry: { triangleBevelSegments: 4, cylinderRadialSegments: 64, orbitTubular: 384, orbitRadial: 8 },
    idleFps: 30,
  },
  REALTIME_MEDIUM: {
    id: 'REALTIME_MEDIUM', tier: 2, backend: 'webgl2', pixelRatioCap: 1.5, renderScale: 1, msaa: 4,
    shadows: { enabled: true, mapSize: 2048, contactBlob: false },
    gtao: { enabled: true, samples: 8, intensity: 0.8 }, ssr: { enabled: false },
    bloom: { strength: 0.34, radius: 0.55, resolutionScale: 0.5 },
    dof: { enabled: true, apertureScale: 1, maxBlur: 0.008 }, smaa: false,
    particles: { core: 5000, vapor: 2500, sparks: 2800, maxPointSize: 128, octaves: 3, curl: false, vaporErosion: true },
    geometry: { triangleBevelSegments: 5, cylinderRadialSegments: 96, orbitTubular: 512, orbitRadial: 8 },
    idleFps: 30,
  },
  REALTIME_HIGH: {
    id: 'REALTIME_HIGH', tier: 3, backend: 'webgl2', pixelRatioCap: 2, renderScale: 1, msaa: 4,
    shadows: { enabled: true, mapSize: 2048, contactBlob: false },
    gtao: { enabled: true, samples: 16, intensity: 1 }, ssr: { enabled: false }, // TODO(Fase 2): SSR selectivo (no cableado en Fase 1)
    bloom: { strength: 0.38, radius: 0.6, resolutionScale: 0.75 },
    dof: { enabled: true, apertureScale: 1, maxBlur: 0.01 }, smaa: false,
    particles: { core: 8000, vapor: 4000, sparks: 4500, maxPointSize: 160, octaves: 4, curl: true, vaporErosion: true },
    geometry: { triangleBevelSegments: 5, cylinderRadialSegments: 96, orbitTubular: 512, orbitRadial: 10 },
    idleFps: 30,
  },
};

export const TIER_ORDER: TierId[] = ['REALTIME_SAFE', 'REALTIME_LOW', 'REALTIME_MEDIUM', 'REALTIME_HIGH'];

export function tierFromScore(score: number): TierId {
  if (score >= 75) return 'REALTIME_HIGH';
  if (score >= 55) return 'REALTIME_MEDIUM';
  if (score >= 35) return 'REALTIME_LOW';
  return 'REALTIME_SAFE';
}

/** Modificadores móviles: resolución, partículas y DoF reducidos (misma narrativa). */
export function applyMobileModifiers(cfg: QualityConfig): QualityConfig {
  return {
    ...cfg,
    pixelRatioCap: Math.min(cfg.pixelRatioCap, 1.5),
    dof: { ...cfg.dof, enabled: false },
    ssr: { enabled: false },
    particles: {
      ...cfg.particles,
      core: Math.round(cfg.particles.core * 0.5),
      vapor: Math.round(cfg.particles.vapor * 0.5),
      sparks: Math.round(cfg.particles.sparks * 0.5),
      maxPointSize: Math.min(cfg.particles.maxPointSize, 96),
    },
  };
}
