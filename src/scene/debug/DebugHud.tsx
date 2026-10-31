import { useEffect, useState } from 'react';
import type { StoryState } from '../animation/storyState';

/** Solo con ?debug=1: progreso, capítulo, tier, score y frame times. */
export function DebugHud({ state }: { state: StoryState }) {
  const enabled = new URLSearchParams(window.location.search).has('debug');
  const [text, setText] = useState('');
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      const rt = window.__RISYNK__?.runtime;
      const d = rt?.getDebug();
      setText(
        [
          `progress ${(state.progress * 100).toFixed(1)}%  chapter ${state.chapter + 1}`,
          d ? `tier ${d.tier}  backend ${d.backend}  frames ${d.frames}` : 'runtime n/a',
          d ? `score ${d.perf.score ?? '…'}  p50 ${d.perf.frameP50.toFixed(1)}ms  p95 ${d.perf.frameP95.toFixed(1)}ms  cpu ${d.perf.cpuMs.toFixed(2)}ms` : '',
          d ? `gpu ${d.perf.gpuMs !== null ? d.perf.gpuMs.toFixed(2) + 'ms' : 'no medido'}  longtasks ${d.perf.longTasks}` : '',
        ].join('\n'),
      );
    }, 400);
    return () => window.clearInterval(id);
  }, [enabled, state]);
  if (!enabled) return null;
  return (
    <pre style={{ position: 'absolute', right: 12, bottom: 12, margin: 0, padding: 10, font: '11px/1.3 ui-monospace, monospace', background: 'var(--color-pure-white)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--color-off-black)', zIndex: 30, pointerEvents: 'none' }}>
      {text}
    </pre>
  );
}
