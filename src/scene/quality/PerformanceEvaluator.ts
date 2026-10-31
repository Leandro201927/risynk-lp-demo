import type { Capabilities } from './CapabilityDetector';
import { isSoftwareRenderer } from './CapabilityDetector';

export interface PerfSnapshot {
  samples: number;
  frameP50: number;
  frameP95: number;
  cpuMs: number;
  gpuMs: number | null; // medido con EXT_disjoint_timer_query_webgl2; null = no medido
  longTasks: number;
  score: number | null;
  gpuMeasured: boolean;
}

type TimerExt = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };

/**
 * Evaluación preliminar (Fase 1). No inventa tiempos GPU: si no hay timer query, el componente GPU
 * se marca como NO MEDIDO y la estabilidad de frames se usa como proxy (declarado en el snapshot).
 * El scoring definitivo, la histéresis y la resolución dinámica corresponden a la Fase 3.
 */
export class PerformanceEvaluator {
  private frames: number[] = [];
  private cpu: number[] = [];
  private gpu: number[] = [];
  private longTasks = 0;
  private obs: PerformanceObserver | null = null;
  private ext: TimerExt | null = null;
  private pending: WebGLQuery | null = null;
  private active: WebGLQuery | null = null;
  private last = 0;
  snapshot: PerfSnapshot = { samples: 0, frameP50: 0, frameP95: 0, cpuMs: 0, gpuMs: null, longTasks: 0, score: null, gpuMeasured: false };

  constructor(private gl: WebGL2RenderingContext, private caps: Capabilities) {
    const e = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (e) this.ext = e as unknown as TimerExt;
    try {
      this.obs = new PerformanceObserver((list) => {
        this.longTasks += list.getEntries().length;
      });
      this.obs.observe({ entryTypes: ['longtask'] });
    } catch {
      this.obs = null;
    }
  }

  beginGpu(): void {
    if (!this.ext || this.active) return;
    this.collectGpu();
    const q = this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  endGpu(): void {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending = this.active;
    this.active = null;
  }

  private collectGpu(): void {
    if (!this.ext || !this.pending) return;
    const gl = this.gl;
    const ready = gl.getQueryParameter(this.pending, gl.QUERY_RESULT_AVAILABLE) as boolean;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
    if (ready) {
      if (!disjoint) this.gpu.push((gl.getQueryParameter(this.pending, gl.QUERY_RESULT) as number) / 1e6);
      gl.deleteQuery(this.pending);
      this.pending = null;
    }
  }

  sample(now: number, cpuMs: number): void {
    if (this.last) {
      const dt = now - this.last;
      if (dt < 250) this.frames.push(dt); // ignora pausas de pestaña
    }
    this.last = now;
    this.cpu.push(cpuMs);
    if (this.frames.length > 240) this.frames.shift();
    if (this.cpu.length > 240) this.cpu.shift();
    if (this.gpu.length > 240) this.gpu.shift();
    if (this.frames.length % 15 === 0) this.recompute();
  }

  private pct(arr: number[], p: number): number {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(p * s.length))] as number;
  }

  private recompute(): void {
    const p50 = this.pct(this.frames, 0.5), p95 = this.pct(this.frames, 0.95);
    const cpu = this.cpu.reduce((a, b) => a + b, 0) / Math.max(1, this.cpu.length);
    const gpu = this.gpu.length ? this.gpu.reduce((a, b) => a + b, 0) / this.gpu.length : null;
    const c = this.caps;
    const stability = Math.max(0, Math.min(20, 20 * (1 - (p95 - 16.7) / 30)));
    const cpuScore = Math.max(0, Math.min(15, 15 * (1 - cpu / 12)));
    const feat = (c.webgl2 ? 4 : 0) + (c.halfFloat ? 3 : 0) + (c.timerQuery ? 1 : 0) + (c.maxSamples >= 4 ? 2 : 0);
    const mem = Math.min(10, ((c.deviceMemory ?? 4) / 8) * 6 + Math.min(4, c.cores / 2));
    // GPU (45): medido si hay timer query; si no, proxy declarado a partir del p50 de frame.
    const gpuScore = gpu !== null ? Math.max(0, Math.min(45, 45 * (1 - gpu / 14))) : Math.max(0, Math.min(45, 45 * (1 - (p50 - 8) / 20)));
    let score = gpuScore + stability + cpuScore + feat + mem;
    if (isSoftwareRenderer(c)) score = Math.min(score, 30);
    this.snapshot = {
      samples: this.frames.length, frameP50: p50, frameP95: p95, cpuMs: cpu, gpuMs: gpu,
      longTasks: this.longTasks, score: this.frames.length >= 90 ? Math.round(score) : null, gpuMeasured: gpu !== null,
    };
  }

  dispose(): void {
    this.obs?.disconnect();
    if (this.pending) this.gl.deleteQuery(this.pending);
    if (this.active) this.gl.deleteQuery(this.active);
  }
}
