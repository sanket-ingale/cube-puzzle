import { useState } from 'react';
import { MOVE_FACES } from '../cube/moves';
import { useCubeStore } from '../game/store';

/** On-screen buttons for every layer turn, with a toggle for counter-clockwise. */
export function MovePad() {
  const playing = useCubeStore((s) => s.mode === 'play');
  const enqueue = useCubeStore((s) => s.enqueue);
  const [prime, setPrime] = useState(false);

  return (
    <section className="panel pad" aria-label="Move buttons">
      {MOVE_FACES.map((face) => (
        <button
          key={face}
          type="button"
          className="move"
          disabled={!playing}
          aria-label={`Turn ${face}${prime ? ' counter-clockwise' : ''}`}
          onClick={() => enqueue([{ face, amount: prime ? -1 : 1 }])}
        >
          {face}
          {prime && "'"}
        </button>
      ))}
      <button
        type="button"
        className={prime ? 'move toggle on' : 'move toggle'}
        aria-pressed={prime}
        aria-label="Counter-clockwise"
        onClick={() => setPrime((p) => !p)}
      >
        '
      </button>
    </section>
  );
}
