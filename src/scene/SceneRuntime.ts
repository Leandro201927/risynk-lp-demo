import { CHAPTER_SIDES } from './animation/storyChapters';
import { Mesh, Vector3, type Object3D, type WebGLRenderer } from 'three';
import { hashState, type StoryState } from './animation/storyState';
import { LiveSceneBackend } from './createScene';
import { createRenderer, selectBackend } from './RendererFactory';
import { WebGLPipeline } from './postprocessing/createWebGLPipeline';
import { detectCapabilities, type Capabilities } from './quality/CapabilityDetector';
import { PerformanceEvaluator, type PerfSnapshot } from './quality/PerformanceEvaluator';
import { adjustTier, pickInitialTier, resolveConfig } from './quality/RenderProfileManager';
import type { QualityConfig, TierId } from './quality/qualityProfiles';
import { AssetManager } from './assets/AssetManager';

export interface RuntimeCallbacks {
  onContextLost: () => void;
  onContextRestored: () => void;
  onFatal: (err: unknown) => void;
}

export interface RuntimeDebug {
  tier: TierId;
  backend: string;
  caps: Capabilities;
  perf: PerfSnapshot;
  config: QualityConfig;
  frames: number;
}

/** Orquesta renderer, escena única, pipeline, bucle de render y ciclo de vida. */
export class SceneRuntime {
  private renderer!: WebGLRenderer;
  private backend!: LiveSceneBackend;
  private pipeline!: WebGLPipeline;
  private evaluator!: PerformanceEvaluator;
  private caps: Capabilities;
  private config!: QualityConfig;
  private tier!: TierId;
  private tierLocked: boolean;
  private ssrOverride: boolean | null;
  private raf = 0;
  private running = false;
  private disposed = false;
  private lost = false;
  private visibleDoc = !document.hidden;
  private visibleStage = true;
  private lastHash = NaN;
  private lastRender = 0;
  private forceRender = true;
  private frames = 0;
  private adjusted = false;
  private observers: Array<() => void> = [];
  private ro: ResizeObserver | null = null;
  private assets = new AssetManager();
  private lastChapter = -1;

  constructor(private canvas: HTMLCanvasElement, private container: HTMLElement, private state: StoryState, private cb: RuntimeCallbacks) {
    this.caps = detectCapabilities();
    const params = new URLSearchParams(window.location.search);
    const tierParam = params.get('tier');
    const ssr = params.get('ssr');
    this.tierLocked = tierParam !== null;
    this.ssrOverride = ssr === null ? null : ssr === '1';
    if (!this.caps.webgl2) throw new Error('WebGL 2 no disponible');
    selectBackend(this.caps);
    this.tier = pickInitialTier(this.caps, tierParam === null ? null : Number(tierParam));
    this.renderer = createRenderer(canvas);
    this.buildAll();
    this.bindLifecycle();
    this.resize();
  }

  get capabilities(): Capabilities {
    return this.caps;
  }

  private buildAll(): void {
    this.config = resolveConfig(this.tier, this.caps, this.ssrOverride);
    // SSR no está cableado en la Fase 1 (pendiente de validar visualmente): se declara y no se activa en silencio.
    if (this.config.ssr.enabled) {
      console.info('[RISYNK] SSR solicitado pero no implementado en Fase 1; se omite.');
      this.config = { ...this.config, ssr: { enabled: false } };
    }
    this.backend = new LiveSceneBackend(this.renderer, this.config);
    this.backend.reducedMotion = this.caps.reducedMotion;
    this.pipeline = new WebGLPipeline(this.renderer, this.backend.scene, this.backend.camera.camera, this.config);
    this.pipeline.refreshBloomList();
    this.evaluator = new PerformanceEvaluator(this.renderer.getContext() as WebGL2RenderingContext, this.caps);
  }

  private teardown(): void {
    this.evaluator?.dispose();
    this.pipeline?.destroy();
    this.backend?.dispose();
  }

  private bindLifecycle(): void {
    const onLost = (e: Event): void => {
      e.preventDefault();
      this.lost = true;
      this.stop();
      this.cb.onContextLost();
    };
    const onRestored = (): void => {
      try {
        this.teardown();
        this.buildAll();
        this.resize();
        this.lost = false;
        this.forceRender = true;
        this.cb.onContextRestored();
        this.start();
      } catch (err) {
        this.cb.onFatal(err);
      }
    };
    this.canvas.addEventListener('webglcontextlost', onLost);
    this.canvas.addEventListener('webglcontextrestored', onRestored);
    this.observers.push(() => {
      this.canvas.removeEventListener('webglcontextlost', onLost);
      this.canvas.removeEventListener('webglcontextrestored', onRestored);
    });

    const onVis = (): void => {
      this.visibleDoc = !document.hidden;
      this.visibleDoc && this.visibleStage ? this.start() : this.stop();
    };
    document.addEventListener('visibilitychange', onVis);
    this.observers.push(() => document.removeEventListener('visibilitychange', onVis));

    const io = new IntersectionObserver((entries) => {
      this.visibleStage = entries.some((e) => e.isIntersecting);
      this.visibleDoc && this.visibleStage ? this.start() : this.stop();
    });
    io.observe(this.container);
    this.observers.push(() => io.disconnect());

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = (): void => {
      this.caps.reducedMotion = mq.matches;
      this.backend.reducedMotion = mq.matches;
      this.forceRender = true;
    };
    mq.addEventListener('change', onMq);
    this.observers.push(() => mq.removeEventListener('change', onMq));
  }

  /** Encuadre: en escritorio el sujeto se centra en el espacio libre a la derecha de la columna de texto. */
  private resize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const q = this.config;
    const dpr = Math.min(window.devicePixelRatio || 1, q.pixelRatioCap) * q.renderScale;
    this.pipeline.setSize(w, h, dpr);
    this.backend.pixelRatio = dpr;
    this.backend.drawingBufferHeight = h * dpr;
    const cam = this.backend.camera;
    cam.setAspect(w / h);
    const nav = document.querySelector<HTMLElement>('.nav');
    const topInsetFraction = nav ? Math.min(0.25, Math.max(0, nav.getBoundingClientRect().bottom) / h) : 0;
    const mobile = window.innerWidth < 768;
    if (mobile !== cam.isMobile) cam.rebuild(mobile);
    if (mobile) {
      cam.region = { ndcShiftX: 0, widthFraction: 1, topInsetFraction };
      cam.layoutMix = 0;
      this.desktopLayout = false;
      this.layoutMix = 0;
      this.container.style.removeProperty('--stage-mask-a');
      this.container.style.removeProperty('--stage-mask-b');
      this.container.style.removeProperty('--stage-mask-c');
      this.container.style.removeProperty('--stage-mask-d');
    } else {
      const panel = document.querySelector<HTMLElement>('.stage-info__col .chapter');
      const col = document.querySelector<HTMLElement>('.stage-info__col');
      const panelW = panel ? panel.getBoundingClientRect().width : w * 0.38;
      const colRect = col ? col.getBoundingClientRect() : { left: 0, right: w };
      // Región libre de la escena para cada lado del contenido.
      this.regionA = { left: Math.min(w * 0.7, colRect.left + panelW + 50), right: w }; // texto a la izquierda
      this.regionB = { left: 0, right: Math.max(w * 0.3, colRect.right - panelW - 50) }; // texto a la derecha
      this.topInsetFraction = topInsetFraction;
      this.desktopLayout = true;
      this.applyLayout();
    }
    this.forceRender = true;
  }

  private regionA = { left: 0, right: 0 };
  private regionB = { left: 0, right: 0 };
  private topInsetFraction = 0;
  private desktopLayout = false;
  private layoutMix = 0;
  private layoutLast = 0;

  /** Interpola la región libre entre ambos lados y actualiza el punto principal y la máscara editorial. */
  private applyLayout(): void {
    if (!this.desktopLayout) return;
    const w = this.container.clientWidth || window.innerWidth;
    const m = this.layoutMix;
    const L = this.regionA.left + (this.regionB.left - this.regionA.left) * m;
    const R = this.regionA.right + (this.regionB.right - this.regionA.right) * m;
    const cam = this.backend.camera;
    cam.layoutMix = m;
    cam.region = { ndcShiftX: (L + R) / w - 1, widthFraction: (R - L) / w, topInsetFraction: this.topInsetFraction };
    const st = this.container.style;
    st.setProperty('--stage-mask-a', `${L - 80}px`);
    st.setProperty('--stage-mask-b', `${L - 10}px`);
    st.setProperty('--stage-mask-c', `${R + 10}px`);
    st.setProperty('--stage-mask-d', `${R + 80}px`);
  }

  /** Transición temporal (independiente del scroll) hacia el lado del capítulo activo. */
  private stepLayout(t: number): void {
    if (!this.desktopLayout) return;
    const dt = Math.min(0.1, Math.max(0, (t - this.layoutLast) / 1000));
    this.layoutLast = t;
    const target = CHAPTER_SIDES[Math.min(CHAPTER_SIDES.length - 1, Math.max(0, this.state.chapter))] as number;
    const diff = target - this.layoutMix;
    if (Math.abs(diff) < 0.0005) {
      if (this.layoutMix !== target) { this.layoutMix = target; this.applyLayout(); this.forceRender = true; }
      return;
    }
    this.layoutMix += diff * (1 - Math.exp(-dt * 3.2));
    this.applyLayout();
    this.forceRender = true;
  }

  start(): void {
    if (this.running || this.disposed || this.lost) return;
    this.running = true;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private frame = (t: number): void => {
    this.raf = 0;
    if (!this.running || this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const s = this.state;
    this.stepLayout(t);
    const hash = hashState(s);
    const dirty = hash !== this.lastHash || this.forceRender;
    if (!dirty) {
      // Sin cambios de narrativa: solo sombreado ambiental a baja frecuencia; con reduced motion no se renderiza.
      if (this.caps.reducedMotion) return;
      if (t - this.lastRender < 1000 / this.config.idleFps) return;
    }
    this.lastHash = hash;
    this.forceRender = false;
    this.lastRender = t;
    try {
      const cpu0 = performance.now();
      const now = t / 1000;
      this.backend.update(s, now);
      const cam = this.backend.camera;
      this.pipeline.setFrameParams({ gtaoBlend: s.gtaoBlend, focus: cam.focusDistance, aperture: cam.aperture, bloomStrength: 1 });
      this.evaluator.beginGpu();
      this.pipeline.render();
      this.evaluator.endGpu();
      this.evaluator.sample(t, performance.now() - cpu0);
      this.frames++;
      if (s.chapter !== this.lastChapter) {
        this.lastChapter = s.chapter;
        this.assets.preload(1, s.chapter);
      }
      this.maybeAdjust();
    } catch (err) {
      this.stop();
      this.cb.onFatal(err);
    }
  };

  /** Ajuste preliminar único tras la evaluación inicial (sin histéresis; Fase 3). No reinicia la narrativa. */
  private maybeAdjust(): void {
    if (this.adjusted) return;
    const score = this.evaluator.snapshot.score;
    if (score === null) return;
    this.adjusted = true;
    const next = adjustTier(this.tier, score, this.tierLocked);
    if (next) this.setTier(next);
  }

  setTier(id: TierId): void {
    this.tier = id;
    this.config = resolveConfig(id, this.caps, this.ssrOverride);
    this.config = { ...this.config, ssr: { enabled: false } };
    this.backend.setQuality(this.config);
    this.pipeline.rebuild(this.config);
    this.resize();
  }

  /** Fija el progreso y fuerza un render (solo depuración y verificación). */
  getDebug(): RuntimeDebug {
    return { tier: this.tier, backend: 'webgl2', caps: this.caps, perf: this.evaluator.snapshot, config: this.config, frames: this.frames };
  }

  /**
   * Verificación de encuadre: proyecta los vértices reales de cada elemento a píxeles CSS del contenedor.
   * Solo depuración (?debug); no interviene en el render.
   */
  debugBounds(): { w: number; h: number; regionLeft: number; items: Record<string, { x0: number; y0: number; x1: number; y1: number }> } {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const cam = this.backend.camera.camera;
    cam.updateMatrixWorld(true);
    const v = new Vector3();
    const rectOf = (objs: Object3D[], filter?: (m: Mesh) => boolean): { x0: number; y0: number; x1: number; y1: number } | null => {
      const r = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      let any = false;
      for (const o of objs) {
        o.updateWorldMatrix(true, true);
        o.traverse((n) => {
          const m = n as Mesh;
          if (!m.isMesh || !m.visible || (filter && !filter(m))) return;
          const pos = m.geometry.attributes.position;
          if (!pos) return;
          const step = Math.max(1, Math.floor(pos.count / 4000));
          for (let i = 0; i < pos.count; i += step) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).project(cam);
            const x = (v.x * 0.5 + 0.5) * w, y = (1 - (v.y * 0.5 + 0.5)) * h;
            r.x0 = Math.min(r.x0, x); r.x1 = Math.max(r.x1, x); r.y0 = Math.min(r.y0, y); r.y1 = Math.max(r.y1, y);
            any = true;
          }
        });
      }
      return any ? r : null;
    };
    const b = this.backend;
    const items: Record<string, { x0: number; y0: number; x1: number; y1: number }> = {};
    const add = (k: string, r: ReturnType<typeof rectOf>): void => { if (r) items[k] = r; };
    add('triangle', rectOf([b.triangle.group], (m) => m.name.startsWith('TriangleBeam')));
    add('storefront', rectOf([b.storefront.group]));
    add('rocket', b.cylinder.group.visible ? rectOf([b.cylinder.group]) : null);
    add('orbits', rectOf([b.orbits.root], (m) => m.name.startsWith('Orbit_')));
    const left = w * (1 - b.camera.region.widthFraction);
    return { w, h, regionLeft: left, items };
  }

  get backendRef(): LiveSceneBackend {
    return this.backend;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.ro?.disconnect();
    this.observers.forEach((o) => o());
    this.observers = [];
    this.teardown();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
