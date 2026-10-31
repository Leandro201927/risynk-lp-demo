import { useCallback, useMemo, useState } from 'react';
import { Navigation } from '../components/Navigation/Navigation';
import { Story } from '../components/Story/Story';
import { StaticFallback } from '../components/StaticFallback/StaticFallback';
import { detectCapabilities } from '../scene/quality/CapabilityDetector';

export function App() {
  const webgl2 = useMemo(() => detectCapabilities().webgl2, []);
  const [fatal, setFatal] = useState<string | null>(null);
  const [chapter, setChapter] = useState(0);
  const onFatal = useCallback((err: unknown) => {
    console.error('[RISYNK] Fallo del renderer; se muestra la presentación estática.', err);
    setFatal(err instanceof Error ? err.message : String(err));
  }, []);

  // Sin WebGL 2 (o fallo irrecuperable del renderer): presentación estática HTML/SVG, no se simula la escena 3D.
  if (!webgl2 || fatal) {
    return (
      <>
        <Navigation chapter={0} />
        <StaticFallback reason={!webgl2 ? 'WebGL 2 no disponible' : (fatal as string)} />
      </>
    );
  }
  return (
    <>
      <Navigation chapter={chapter} />
      <main id="top">
        <Story onChapter={setChapter} onFatal={onFatal} />
      </main>
    </>
  );
}
