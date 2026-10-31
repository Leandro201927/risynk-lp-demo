import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createInitialStoryState, ORBIT_PHASE_FINAL, type StoryState } from './storyState';
import { CHAPTER_BOUNDS, READING_ANCHORS, chapterFromProgress } from './storyChapters';
import { launchEase } from './easing';

gsap.registerPlugin(ScrollTrigger);

type Key = Exclude<keyof StoryState, 'progress' | 'chapter' | 'exhaustProgress' | 'introDolly'>;
const FORBIDDEN_EASES = /elastic|bounce|back/;

/** Una unidad de timeline = 1 % del progreso. Tweens por propiedad sin solapes, con valores explícitos. */
function makeTweener(tl: gsap.core.Timeline, state: StoryState) {
  return (key: Key, from: number, to: number, t0: number, t1: number, ease = 'power2.inOut'): void => {
    if (FORBIDDEN_EASES.test(ease)) throw new Error(`Ease prohibido: ${ease}`);
    tl.fromTo(state, { [key]: from }, { [key]: to, duration: t1 - t0, ease, immediateRender: false }, t0);
  };
}

/** Define TODA la narrativa (cámara, objetos, energía, cilindro, órbitas). Es la única fuente de verdad. */
export function defineCinematicTracks(tl: gsap.core.Timeline, state: StoryState): void {
  const T = makeTweener(tl, state);

  // CÁMARA — índice de plano continuo (SHOTS): 0 fachada · 1 revelación · 2 necesidad · 3 transformación ·
  // 4 activación · 5 órbitas · 6 final. El seguimiento del cohete se mezcla encima (cameraTrack).
  T('cameraU', 0, 0.08, 11, 14, 'power1.in');
  T('cameraU', 0.08, 1, 14, 25);
  T('cameraU', 1, 2, 29, 34);
  T('cameraU', 2, 2.15, 34, 38, 'sine.inOut');
  T('cameraU', 2.15, 3, 42, 47);
  T('cameraU', 3, 4, 58, 63);
  T('cameraTrack', 0, 1, 73, 76);
  T('cameraTrack', 1, 0, 81, 87);
  T('cameraU', 4, 5, 80, 88);
  T('cameraU', 5, 6, 94, 99);
  T('cameraLift', 0, 1, 63, 68, 'sine.inOut');
  T('dofAmount', 1, 0.2, 23, 25, 'power1.inOut');
  T('dofAmount', 0.2, 0.5, 29, 34, 'power1.inOut');
  T('dofAmount', 0.5, 0.3, 42, 47, 'power1.inOut');
  T('dofAmount', 0.3, 0, 73, 76, 'power1.out');
  // El AO usa la geometría completa aunque las vigas aún no se hayan revelado: solo se activa con el triángulo completo.
  T('gtaoBlend', 0, 1, 23, 25, 'power1.inOut');

  // TRIÁNGULO (revelación secuencial por vigas + una línea cian que lo recorre una sola vez)
  T('triangleReveal', 1 / 3, 2 / 3, 15, 19);
  T('triangleReveal', 2 / 3, 1, 19, 23);
  T('triangleSweep', 0, 1, 22, 27, 'sine.inOut');
  T('triangleEmission', 0, 0.26, 24, 28, 'power1.inOut');
  T('triangleEmission', 0.26, 0.36, 52, 56, 'power1.inOut');
  T('triangleEmission', 0.36, 0.5, 93, 97, 'power1.inOut');

  // ESCENA 03 — NECESIDAD: un único punto recorre la viga inferior y se dirige a la fachada
  T('needSignal', 0, 1, 31, 33, 'power2.out');
  T('needTravel', 0, 0.75, 33, 38, 'sine.inOut');
  T('edgeLit0', 0, 0.4, 36, 38, 'power1.inOut');
  T('needTravel', 0.75, 1, 38, 39.5, 'power2.out');

  // ESCENA 04 — TRANSFORMACIÓN: la energía llega a la fachada y se reparte, viga a viga, en orden
  T('needTravel', 1, 1.15, 43, 45);
  T('storeEnergy', 0, 1, 44, 46.5, 'power2.inOut');
  T('coreFlash', 0, 1, 45, 46.2, 'power2.out');
  T('coreFlash', 1, 0, 46.2, 49, 'power2.inOut');
  T('needSignal', 1, 0, 45, 46.5, 'power1.in');
  T('splitTravel', 0, 1, 46.5, 55, 'sine.inOut');
  T('storeEnergy', 1, 0.35, 55, 58, 'power1.inOut');

  // ESCENA 05 — ACTIVACIÓN: convergencia al vértice, carga, cohete que se construye en su cuna, ignición y pausa
  T('ascent', 0, 1, 59, 63, 'power2.in');
  T('vertexCharge', 0, 1, 63, 65, 'power2.in');
  T('haloWave', 0, 1, 65, 66.5, 'power2.out');
  T('cylinderVisibility', 0, 1, 66, 69, 'power1.inOut');
  T('nozzleGlow', 0, 1, 69.5, 71, 'power2.in');
  T('vertexCharge', 1, 1.25, 71, 72, 'power1.in');
  T('storeEnergy', 0.35, 0.2, 63, 70, 'power1.inOut');

  // ESCENA 06 — SEPARACIÓN, LANZAMIENTO, ÓRBITAS, RETORNO
  T('vertexCharge', 1.25, 0.3, 73, 75, 'power1.out');
  T('exhaustIntensity', 0, 1, 73, 74, 'power2.out');
  T('cylinderAlign', 0, 1, 73, 79, 'sine.inOut'); // se orienta con la trayectoria mientras abandona la cuna
  T('cylinderProgress', 0, 1, 73, 90, ((tau: number) => launchEase(tau)) as unknown as string);
  T('orbitIntensity', 0, 1, 79.5, 81, 'power1.inOut');
  T('orbitFormation1', 0, 1, 82, 87);
  T('orbitFormation2', 0, 1, 84, 89);
  T('orbitFormation0', 0, 1, 88, 91);
  T('launchTrailFade', 0, 1, 86, 92, 'power1.inOut');
  T('cylinderVisibility', 1, 0, 89, 90, 'power1.in');
  T('exhaustIntensity', 1, 0, 89, 90, 'power1.in');
  T('nozzleGlow', 1, 0, 89, 90, 'power1.in');
  // La rotación del anillo 1 empieza cuando el cohete ya lo abandona (continuidad de la estela).
  T('orbitPhase', 0, ORBIT_PHASE_FINAL, 88, 95, 'power2.inOut');
  T('orbitSynchronization', 0, 1, 90, 95);
  T('orbitConnect', 0, 1, 93, 96, 'power1.inOut');
  T('returnPulse', 0, 1, 95, 97.5, 'sine.inOut');
}

/** Textos HTML sincronizados con el mismo timeline. */
function defineTextTracks(tl: gsap.core.Timeline, panels: HTMLElement[], reduced: boolean): void {
  const enter: Array<[number, number]> = [[0, 0], [14.5, 16.5], [29.5, 31.5], [42.5, 44.5], [58.5, 60.5], [74, 76]];
  const exit: Array<[number, number]> = [[12, 14], [27.5, 29], [41, 42], [56.8, 58], [72, 73], [100, 100]];
  const y = reduced ? 0 : 12;
  panels.forEach((panel, i) => {
    const inner = panel.querySelector('.chapter__inner');
    if (i === 0) tl.set(panel, { autoAlpha: 1 }, 0);
    else {
      tl.fromTo(panel, { autoAlpha: 0 }, { autoAlpha: 1, duration: (enter[i] as [number, number])[1] - (enter[i] as [number, number])[0], ease: 'power2.out', immediateRender: false }, (enter[i] as [number, number])[0]);
      if (inner) tl.fromTo(inner, { y }, { y: 0, duration: 2, ease: 'power2.out', immediateRender: false }, (enter[i] as [number, number])[0]);
    }
    if (i < panels.length - 1) {
      const [e0, e1] = exit[i] as [number, number];
      tl.fromTo(panel, { autoAlpha: 1 }, { autoAlpha: 0, duration: e1 - e0, ease: 'power1.in', immediateRender: false }, e0);
      if (inner) tl.fromTo(inner, { y: 0 }, { y: reduced ? 0 : -8, duration: e1 - e0, ease: 'power1.in', immediateRender: false }, e0);
    }
    const tags = panel.querySelectorAll<HTMLElement>('.tag, .chapter__cta, .chapter__closing');
    if (tags.length && i > 0) {
      const base = (enter[i] as [number, number])[0] + 1.5;
      tl.fromTo(tags, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4, stagger: i === 5 ? 1.4 : 0.6, ease: 'power2.out', immediateRender: false }, base);
    }
  });
}

export interface TimelineHandle {
  kill: () => void;
}

export interface TimelineOptions {
  trigger: HTMLElement;
  panels: HTMLElement[];
  canvasWrap: HTMLElement | null;
  progressBar: HTMLElement | null;
  state: StoryState;
  onChapter: (chapter: number) => void;
}

/** Captura el estado en cada ancla de lectura recorriendo la misma definición cinemática. */
function snapshotsAtAnchors(): StoryState[] {
  const scratch = createInitialStoryState();
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  defineCinematicTracks(tl, scratch);
  tl.to({}, { duration: 0 }, 100);
  return READING_ANCHORS.map((a) => {
    tl.time(a, false);
    return { ...scratch };
  });
}

export function createStoryTimeline(opts: TimelineOptions): TimelineHandle {
  const { state, trigger, panels } = opts;
  let lastChapter = -1;
  const sync = (progress: number): void => {
    state.progress = progress;
    const ch = chapterFromProgress(progress);
    state.chapter = ch;
    if (ch !== lastChapter) {
      lastChapter = ch;
      opts.onChapter(ch);
    }
    if (opts.progressBar) opts.progressBar.style.transform = `scaleX(${progress.toFixed(4)})`;
  };

  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger, start: 'top top', end: 'bottom bottom', scrub: 0.8, invalidateOnRefresh: true },
      onUpdate: () => sync(tl.progress()),
    });
    defineCinematicTracks(tl, state);
    defineTextTracks(tl, panels, false);
    tl.to({}, { duration: 0 }, 100);
    sync(0);
  });

  mm.add('(prefers-reduced-motion: reduce)', () => {
    const snaps = snapshotsAtAnchors();
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
      onUpdate: () => sync(tl.progress()),
    });
    // Transiciones discretas: fundido corto del canvas en cada frontera de capítulo + salto de estado.
    snaps.forEach((snap, i) => {
      const at = CHAPTER_BOUNDS[i] as number;
      tl.set(state, { ...snap, progress: state.progress, chapter: state.chapter, introDolly: 0 }, at + 0.0001);
      if (opts.canvasWrap && i > 0) {
        tl.fromTo(opts.canvasWrap, { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, at - 0.3);
        tl.fromTo(opts.canvasWrap, { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: false }, at + 0.0001);
      }
    });
    defineTextTracks(tl, panels, true);
    tl.to({}, { duration: 0 }, 100);
    sync(0);
  });

  return {
    kill: () => {
      mm.revert();
      ScrollTrigger.getAll().forEach((st) => st.kill());
    },
  };
}
