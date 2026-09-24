import { useCallback, useMemo } from 'react';
import { toFacelets } from '../cube/facelets';
import { parseMoves } from '../cube/moves';
import { useCubeStore } from '../game/store';
import { useCurrentHint } from '../solver/assist';
import { useGuide } from '../solver/guide';
import { paletteFor } from '../cube/colors';
import { usePrefs } from '../ui/prefs';
import { CircularView } from './CircularView';

/** Connects the circular view to the shared store: it reads the cube and sends moves back. */
export function CircularPanel() {
  const cubies = useCubeStore((s) => s.cubies);
  const locked = useCubeStore((s) => s.mode !== 'play');
  const activeMove = useCubeStore((s) => s.active);
  const grab = useCubeStore((s) => s.grab);
  const enqueue = useCubeStore((s) => s.enqueue);
  const hint = useCurrentHint();
  const guideMove = useGuide((s) => (s.status === 'ready' ? s.plan[0] : null));
  const letters = usePrefs((s) => s.letters);
  const palette = paletteFor(usePrefs((s) => s.highContrast));

  const cubeState = useMemo(() => toFacelets(cubies), [cubies]);
  const onMoveDispatch = useCallback((move: string) => enqueue(parseMoves(move)), [enqueue]);

  return (
    <section className="circular-panel" aria-labelledby="circular-title">
      <h2 id="circular-title" className="side-title">
        2D view
      </h2>
      <CircularView
        cubeState={cubeState}
        onMoveDispatch={onMoveDispatch}
        disabled={locked}
        activeMove={activeMove}
        grab={grab}
        hintMove={guideMove ?? hint}
        palette={palette}
        letters={letters}
      />
    </section>
  );
}
