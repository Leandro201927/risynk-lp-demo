import { useEffect, useRef, useState } from 'react';
import { SceneRuntime } from './SceneRuntime';
import type { StoryState } from './animation/storyState';
import { storyScrollRange } from './animation/storyChapters';
import { StaticArt } from '../components/StaticFallback/StaticArt';

declare global {
  interface Window {
    __RISYNK__?: { state: StoryState; runtime: SceneRuntime | null; goto: (p: number) => void };
  }
}

interface Props {
  state: StoryState;
  onFatal: (err: unknown) => void;
}

const MAX_INIT_RETRIES = 2;

/** Canvas persistente (aria-hidden). Monta/desmonta SceneRuntime de forma idempotente (StrictMode, reintentos). */
export function SceneCanvas({ state, onFatal }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const container = host?.parentElement;
    if (!host || !container) return;
    // Un canvas NUEVO por montaje: forceContextLoss() en dispose inutiliza el canvas (StrictMode monta dos veces).
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.tabIndex = -1;
    host.appendChild(canvas);
    let cancelled = false;
    let runtime: SceneRuntime | null = null;
    let timer = 0;

    const init = (attempt: number): void => {
      if (cancelled) return;
      try {
        runtime = new SceneRuntime(canvas, container, state, {
          onContextLost: () => setLost(true),
          onContextRestored: () => setLost(false),
          onFatal,
        });
        runtime.start();
        if (new URLSearchParams(window.location.search).has('debug')) {
          window.__RISYNK__ = {
            state, runtime,
            goto: (p: number) => {
              const r = storyScrollRange();
              if (r) window.scrollTo({ top: r.top + p * r.range, behavior: 'auto' });
            },
          };
        }
      } catch (err) {
        runtime?.dispose();
        runtime = null;
        if (attempt < MAX_INIT_RETRIES) timer = window.setTimeout(() => init(attempt + 1), attempt === 0 ? 500 : 2000);
        else onFatal(err);
      }
    };
    init(0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      runtime?.dispose();
      canvas.remove();
      if (window.__RISYNK__?.runtime === runtime) window.__RISYNK__ = undefined;
    };
  }, [state, onFatal]);

  return (
    <>
      <div ref={hostRef} className="stage-canvas__host" />
      {lost && (
        <div className="stage-fallback" style={{ display: 'grid', placeItems: 'center', background: 'var(--surface-page-canvas)' }} aria-hidden="true">
          <StaticArt />
        </div>
      )}
    </>
  );
}
