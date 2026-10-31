import { CHAPTERS } from '../../content/storyContent';
import { scrollToChapter } from '../../scene/animation/storyChapters';

export function ChapterRail({ chapter, barRef, side, phase, dir }: { chapter: number; barRef: React.RefObject<HTMLElement | null>; side: 'left' | 'right'; phase: 'in' | 'out' | 'pre'; dir: 1 | -1 }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <div className="rail" role="group" aria-label="Capítulos" data-side={side} data-phase={phase} style={{ ['--dir' as string]: dir }}>
      {CHAPTERS.map((c, i) => (
        <button
          key={c.id}
          type="button"
          className="rail__btn"
          aria-current={chapter === i ? 'step' : undefined}
          aria-label={`Capítulo ${i + 1}: ${c.label}`}
          onClick={() => scrollToChapter(i, reduced)}
        >
          {String(i + 1).padStart(2, '0')}
        </button>
      ))}
      <div className="rail__bar" aria-hidden="true">
        <i ref={barRef as React.RefObject<HTMLElement>} />
      </div>
    </div>
  );
}
