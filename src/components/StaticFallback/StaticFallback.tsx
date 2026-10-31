import { CHAPTERS } from '../../content/storyContent';
import { ChapterPanel } from '../ChapterPanel/ChapterPanel';
import { StaticArt } from './StaticArt';

/**
 * Presentación de emergencia sin WebGL 2: todos los capítulos en flujo normal, con ilustración SVG.
 * No finge ejecutar la escena 3D. TODO: MISSING_FILL(PRERENDER_VIDEO_SEGMENTS) — aquí se integrarán los vídeos de Blender.
 */
export function StaticFallback({ reason }: { reason: string }) {
  return (
    <main id="top" className="static-page">
      <p className="chapter__label" role="status">Versión estática · {reason}</p>
      <div className="static-page__art"><StaticArt /></div>
      {CHAPTERS.map((c, i) => (
        <ChapterPanel key={c.id} chapter={c} index={i} innerStatic />
      ))}
    </main>
  );
}
