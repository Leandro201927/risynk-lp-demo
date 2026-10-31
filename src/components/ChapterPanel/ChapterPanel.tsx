import type { ChapterContent } from '../../content/storyContent';
import { ContactCTA } from '../ContactCTA/ContactCTA';
import { scrollToChapter } from '../../scene/animation/storyChapters';

interface Props {
  chapter: ChapterContent;
  index: number;
  innerStatic?: boolean;
  setRef?: (el: HTMLElement | null) => void;
}

export function ChapterPanel({ chapter, index, innerStatic = false, setRef }: Props) {
  const Heading = index === 0 ? 'h1' : 'h2';
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <section
      ref={setRef}
      className={`chapter${index === 0 ? ' chapter--first' : ''}`}
      aria-labelledby={`ch-${chapter.id}`}
      data-chapter={index}
    >
      <div className="chapter__inner">
        <p className="chapter__label">{chapter.label}</p>
        <Heading id={`ch-${chapter.id}`} className="chapter__title">{chapter.title}</Heading>
        <p className="chapter__desc">{chapter.description}</p>
        {chapter.tags && (
          <ul className="chapter__tags" aria-label="Capacidades">
            {chapter.tags.map((t) => (
              <li key={t}><span className="tag">{t}</span></li>
            ))}
          </ul>
        )}
        {chapter.hint && !innerStatic && (
          <button type="button" className="chapter__hint" onClick={() => scrollToChapter(1, reduced)}>
            {chapter.hint}
          </button>
        )}
        {chapter.cta && (
          <div className="chapter__actions">
            <span className="chapter__cta"><ContactCTA label={chapter.cta} /></span>
            {chapter.closing && <p className="chapter__closing">{chapter.closing}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
