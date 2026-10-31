import { QUALITY_PROFILES, TIER_ORDER, applyMobileModifiers, tierFromScore, type QualityConfig, type TierId } from './qualityProfiles';
import { isSoftwareRenderer, type Capabilities } from './CapabilityDetector';

export function pickInitialTier(caps: Capabilities, override: number | null): TierId {
  if (override !== null && override >= 0 && override <= 3) return TIER_ORDER[override] as TierId;
  if (isSoftwareRenderer(caps)) return 'REALTIME_SAFE';
  if (caps.isMobile) return 'REALTIME_LOW';
  if (!caps.halfFloat) return 'REALTIME_SAFE';
  return 'REALTIME_MEDIUM';
}

export function resolveConfig(id: TierId, caps: Capabilities, ssrOverride: boolean | null): QualityConfig {
  let cfg = QUALITY_PROFILES[id];
  if (caps.isMobile) cfg = applyMobileModifiers(cfg);
  if (cfg.msaa && caps.maxSamples < 4) cfg = { ...cfg, msaa: 0, smaa: true };
  if (caps.reducedMotion) cfg = { ...cfg, particles: { ...cfg.particles, core: Math.round(cfg.particles.core * 0.5) } };
  if (ssrOverride !== null) cfg = { ...cfg, ssr: { enabled: ssrOverride } };
  return cfg;
}

/**
 * Selección preliminar: un único ajuste tras la evaluación inicial (sin histéresis; Fase 3).
 * Devuelve null si no hay cambio. Los perfiles solo cambian qualityConfig, nunca la narrativa.
 */
export function adjustTier(current: TierId, score: number | null, locked: boolean): TierId | null {
  if (locked || score === null) return null;
  const target = tierFromScore(score);
  return target !== current ? target : null;
}
