import { X } from 'lucide-react';
import { formatMove } from '../cube/moves';
import { describeMove, startGuide, stopGuide, useGuide } from '../solver/guide';
import { IconButton } from './IconButton';

/** The guided solve's instructions, shown in place of the timer while the guide is on. */
export function GuidePanel() {
  const { status, plan, made, rerouted } = useGuide();
  if (status === 'off') return null;

  const next = plan[0];
  const total = made + plan.length;

  return (
    <div className="guide" role="status" aria-live="polite">
      <div className="guide-head">
        <span className="guide-title">Guided solve</span>
        {status === 'ready' && (
          <span className="guide-progress">
            Step {made + 1} of {total}
          </span>
        )}
        <IconButton icon={X} label="Stop the guided solve" onClick={stopGuide} />
      </div>

      {status === 'planning' && (
        <p className="guide-text">
          {rerouted ? 'You went your own way, so the guide is working out a new route from here…' : 'Working out a route…'}
        </p>
      )}

      {status === 'ready' && next && (
        <>
          <div className="guide-move">
            <span className="guide-notation">{formatMove(next)}</span>
            <span className="guide-text">{describeMove(next)}</span>
          </div>
          <p className="guide-note">
            Follow the yellow arrow on the cube{rerouted ? '. This is a new route from where you are.' : '.'}
          </p>
        </>
      )}

      {status === 'finishing' && <p className="guide-text">That’s the last move. Watch it land…</p>}

      {status === 'done' && (
        <>
          <p className="guide-text">
            <strong>Solved!</strong> You made {made} {made === 1 ? 'move' : 'moves'} with the guide.
          </p>
          <div className="dialog-actions">
            <button type="button" className="secondary" onClick={startGuide}>
              Another one
            </button>
            <button type="button" className="secondary" onClick={stopGuide}>
              Done
            </button>
          </div>
        </>
      )}

      {status === 'error' && (
        <p className="error-text">The solver couldn’t start, so the guide can’t plan a route. Try reloading the page.</p>
      )}
    </div>
  );
}
