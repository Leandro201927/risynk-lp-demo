import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { CHAPTERS } from '../../content/storyContent';
import { ChapterPanel } from '../ChapterPanel/ChapterPanel';
import { ChapterRail } from './ChapterRail';
import { SceneCanvas } from '../../scene/SceneCanvas';
import { createInitialStoryState } from '../../scene/animation/storyState';
import { createStoryTimeline } from '../../scene/animation/storyTimeline';
import { CHAPTER_SIDES, READING_ANCHORS } from '../../scene/animation/storyChapters';
import { DebugHud } from '../../scene/debug/DebugHud';

interface Props {
  onChapter: (c: number) => void;
  onFatal: (err: unknown) => void;
}

export function Story({ onChapter, onFatal }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const panelRefs = useRef<Array<HTMLElement | null>>([]);
  const stateRef = useRef(createInitialStoryState());
  const [chapter, setChapter] = useState(0);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const panels = panelRefs.current.filter((p): p is HTMLElement => p !== null);
    const state = stateRef.current;
    // Un único contexto GSAP: master timeline + ScrollTrigger + entrada de carga. revert() limpia todo al desmontar.
    const ctx = gsap.context(() => {
      const handle = createStoryTimeline({
        trigger: root,
        panels,
        canvasWrap: canvasWrapRef.current,
        progressBar: barRef.current,
        state,
        onChapter: (c) => {
          setChapter(c);
          onChapter(c);
        },
      });
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduced) {
        // Entrada de carga (basada en tiempo, canales aditivos que vuelven a 0; no entra en conflicto con el scroll).
        gsap.fromTo(state, { introDolly: 1 }, { introDolly: 0, duration: 2.4, ease: 'power2.out', overwrite: false });
        const kids = panels[0]?.querySelectorAll('.chapter__inner > *');
        if (kids?.length) gsap.from(kids, { autoAlpha: 0, y: 14, duration: 1.1, stagger: 0.12, delay: 0.25, ease: 'power2.out', clearProps: 'opacity,visibility,transform' });
      }
      return () => handle.kill();
    }, root);
    return () => ctx.revert();
  }, [onChapter]);

  return (
    <section id="story" className="story" ref={rootRef}>
      {CHAPTERS.map((c, i) => (
        <span
          key={c.id}
          id={c.anchor}
          className="story-anchor"
          style={{ top: `calc((var(--story-length) - 100svh) * ${(READING_ANCHORS[i] as number) / 100})` }}
        />
      ))}
      <div className="stage">
        <div className="stage-canvas" ref={canvasWrapRef}>
          <SceneCanvas state={stateRef.current} onFatal={onFatal} />
        </div>
        <div className="stage-info">
          <div className={`stage-info__col${CHAPTER_SIDES[chapter] === 1 ? ' is-right' : ''}`}>
            {CHAPTERS.map((c, i) => (
              <ChapterPanel key={c.id} chapter={c} index={i} setRef={(el) => { panelRefs.current[i] = el; }} />
            ))}
            <ChapterRail chapter={chapter} barRef={barRef} />
          </div>
        </div>
        <DebugHud state={stateRef.current} />
      </div>
    </section>
  );
}
