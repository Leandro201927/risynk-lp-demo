import { CONTACT, NAV_LINKS, CHAPTERS } from '../../content/storyContent';
import { scrollToChapter } from '../../scene/animation/storyChapters';

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Navigation({ chapter }: { chapter: number }) {
  const go = (index: number) => (e: React.MouseEvent) => {
    if (!document.getElementById('story')) return; // fallback estático: el ancla nativa funciona
    e.preventDefault();
    scrollToChapter(index, reducedMotion());
  };
  return (
    <nav className="nav" aria-label="Principal">
      <a className="nav__brand" href="#top" onClick={go(0)}>RISYNK</a>
      <div className="nav__links">
        {NAV_LINKS.map((l) => (
          <a key={l.label} href={`#${(CHAPTERS[l.chapter] as { anchor: string }).anchor}`} onClick={go(l.chapter)} aria-current={chapter === l.chapter}>
            {l.label}
          </a>
        ))}
      </div>
      <a className="nav__contact" href={`#${(CHAPTERS[5] as { anchor: string }).anchor}`} onClick={go(5)}>
        {CONTACT.navLabel}
      </a>
    </nav>
  );
}
