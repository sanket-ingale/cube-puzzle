import { useEffect, useState } from 'react';
import { Play, Trash2 } from 'lucide-react';
import { parseMoves } from '../cube/moves';
import { useSolveHistory, type Solve } from '../game/solves';
import { formatTime } from '../game/stats';
import { useCubeStore } from '../game/store';
import { Dialog } from './Dialog';
import { IconButton } from './IconButton';
import { useUi } from './uiStore';

const VISIBLE_SOLVES = 50;

export function HistoryDialog() {
  const open = useUi((s) => s.historyOpen);
  const setOpen = useUi((s) => s.setHistoryOpen);
  const solves = useSolveHistory((s) => s.solves);
  const clear = useSolveHistory((s) => s.clear);
  const canReplay = useCubeStore((s) => s.mode === 'play' && s.active === null);
  const replay = useCubeStore((s) => s.replay);
  const [confirming, setConfirming] = useState(false);

  // The clear confirmation backs out on its own if it isn't used.
  useEffect(() => {
    if (!confirming) return;
    const timeout = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timeout);
  }, [confirming]);

  const watch = (solve: Solve) => {
    setOpen(false);
    replay(parseMoves(solve.scramble), parseMoves(solve.solution ?? ''));
  };

  const recent = solves.slice(-VISIBLE_SOLVES).reverse();

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Solve history">
      {solves.length === 0 ? (
        <p className="muted">No solves yet. Scramble the cube and solve it to start your history.</p>
      ) : (
        <>
          <ol className="history-list">
            {recent.map((s, i) => (
              <li key={s.id}>
                <span className="n">{solves.length - i}</span>
                <span className="t">{formatTime(s.timeMs)}</span>
                <span className="m">
                  {s.moves} moves
                  {s.assisted && <span className="tag">hint</span>}
                </span>
                <span className="d">
                  {new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                {s.solution !== undefined ? (
                  <IconButton icon={Play} label={`Replay solve ${solves.length - i}`} onClick={() => watch(s)} disabled={!canReplay} />
                ) : (
                  <span />
                )}
                <code className="scramble" title="Scramble">
                  {s.scramble}
                </code>
              </li>
            ))}
          </ol>
          <p className="muted small">Solves that used a hint are marked and don't count towards your best time or averages.</p>
          <div className="dialog-actions">
            {confirming ? (
              <>
                <button type="button" className="danger" onClick={() => (clear(), setConfirming(false))}>
                  {solves.length === 1 ? 'Delete 1 solve' : `Delete all ${solves.length} solves`}
                </button>
                <button type="button" className="secondary" onClick={() => setConfirming(false)}>
                  Keep them
                </button>
              </>
            ) : (
              <button type="button" className="secondary with-icon" onClick={() => setConfirming(true)}>
                <Trash2 size={16} aria-hidden="true" /> Clear history
              </button>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}
