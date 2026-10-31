import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

declare global {
  interface Window {
    __RISYNK_VITALS__?: Record<string, number>;
  }
}

/**
 * Métricas de experiencia web (no confundir con el rendimiento GPU de PerformanceEvaluator).
 * Sin endpoint en Fase 1: se guardan en window.__RISYNK_VITALS__ y se muestran en consola con ?debug=1 o en desarrollo.
 */
export function initWebVitals(): void {
  const verbose = import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');
  window.__RISYNK_VITALS__ = {};
  const report = (m: Metric): void => {
    (window.__RISYNK_VITALS__ as Record<string, number>)[m.name] = Math.round(m.value * 1000) / 1000;
    if (verbose) console.info(`[web-vitals] ${m.name}`, Math.round(m.value * 1000) / 1000, m.rating);
  };
  onLCP(report);
  onCLS(report);
  onINP(report);
  onFCP(report);
  onTTFB(report);
}
