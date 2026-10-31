import { CHAPTERS } from '../../content/storyContent';

/** Ventanas de progreso (en %) de los seis capítulos. */
export const CHAPTER_BOUNDS = [0, 14, 29, 42, 58, 73, 100] as const;
/** Punto medio de la pausa de lectura de cada capítulo (en %). */
export const READING_ANCHORS = [6, 26, 40, 56, 71, 98] as const;

/** Lado del contenido por capítulo: 0 = texto a la izquierda y escena a la derecha; 1 = texto a la derecha y escena a la izquierda. */
export const CHAPTER_SIDES = [0, 1, 0, 0, 1, 0] as const;

export function chapterFromProgress(progress: number): number {
  const pct = progress * 100;
  for (let i = CHAPTER_BOUNDS.length - 2; i >= 0; i--) {
    if (pct >= (CHAPTER_BOUNDS[i] as number)) return i;
  }
  return 0;
}

export function storyScrollRange(): { top: number; range: number } | null {
  const el = document.getElementById('story');
  if (!el) return null;
  const top = el.getBoundingClientRect().top + window.scrollY;
  return { top, range: Math.max(1, el.offsetHeight - window.innerHeight) };
}

export function scrollToChapter(index: number, reduced: boolean): void {
  const r = storyScrollRange();
  if (!r) return;
  const pct = READING_ANCHORS[Math.max(0, Math.min(CHAPTERS.length - 1, index))] as number;
  window.scrollTo({ top: r.top + (pct / 100) * r.range, behavior: reduced ? 'auto' : 'smooth' });
}
