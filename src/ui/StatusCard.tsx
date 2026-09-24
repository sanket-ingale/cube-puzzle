import { History, Hourglass } from 'lucide-react';
import { isSolved } from '../cube/model';
import { formatMove, formatMoves } from '../cube/moves';
import { useSolveHistory } from '../game/solves';
import { averageOf, best, formatTime } from '../game/stats';
import { useCubeStore } from '../game/store';
import { useAssist, useCurrentHint } from '../solver/assist';
import { IconButton } from './IconButton';
import { Timer } from './Timer';
import { GuidePanel } from './GuidePanel';
import { useGuide } from '../solver/guide';
import { useUi } from './uiStore';

const VISIBLE_MOVES = 40;

function StatusBadge() {
  const mode = useCubeStore((s) => s.mode);
  const lastSolve = useCubeStore((s) => s.lastSolve);
  const solved = useCubeStore((s) => isSolved(s.cubies));

  const busy: Partial<Record<typeof mode, string>> = {
    scrambling: 'Scrambling…',
    resetting: 'Resetting…',
    solving: 'Solving…',
    replaying: 'Replaying…',
  };
  if (busy[mode]) return <span className="badge">{busy[mode]}</span>;
  if (lastSolve) {
    return (
      <span className="badge solved celebrate" role="status">
        Solved in {lastSolve.moves} {lastSolve.moves === 1 ? 'move' : 'moves'}
        {lastSolve.assisted && ' with hints'}
      </span>
    );
  }
  return <span className={solved ? 'badge solved' : 'badge'}>{solved ? 'Solved' : 'Unsolved'}</span>;
}

function StatsRow() {
  const solves = useSolveHistory((s) => s.solves);
  const setHistoryOpen = useUi((s) => s.setHistoryOpen);
  // Solves that used a hint stay in the history but don't count towards the stats.
  const times = solves.filter((s) => !s.assisted).map((s) => s.timeMs);
  const stats = [
    { label: 'Best', value: formatTime(best(times)) },
    { label: 'Ao5', value: formatTime(averageOf(times, 5)) },
    { label: 'Ao12', value: formatTime(averageOf(times, 12)) },
    { label: 'Solves', value: String(solves.length) },
  ];

  return (
    <div className="stats-row">
      <dl className="stats">
        {stats.map(({ label, value }) => (
          <div key={label} className="stat">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <IconButton
        icon={History}
        label="Solve history"
        onClick={() => setHistoryOpen(true)}
        disabled={solves.length === 0}
      />
    </div>
  );
}

export function StatusCard() {
  const history = useCubeStore((s) => s.history);
  const userStart = useCubeStore((s) => s.userStart);
  const scramble = useCubeStore((s) => s.scramble);
  const solvedNow = useCubeStore((s) => s.lastSolve !== null);
  const inspection = useCubeStore((s) => s.inspection);
  const setInspection = useCubeStore((s) => s.setInspection);
  const hint = useCurrentHint();
  const solverError = useAssist((s) => s.error);

  const playerMoves = history.slice(userStart);
  const guiding = useGuide((s) => s.status !== 'off');

  // While guiding, the step to make is the only thing that matters, so the rest steps aside.
  if (guiding) {
    return (
      <section className="panel status" aria-label="Guided solve">
        <GuidePanel />
      </section>
    );
  }

  return (
    <section className="panel status" aria-label="Solve status">
      <div className="status-head">
        <Timer />
        <IconButton
          icon={Hourglass}
          label={inspection ? '15-second inspection: on' : '15-second inspection: off'}
          onClick={() => setInspection(!inspection)}
          pressed={inspection}
        />
      </div>

      <div className="status-line">
        <StatusBadge />
        {!solvedNow && (
          <span className="move-count">
            {playerMoves.length} {playerMoves.length === 1 ? 'move' : 'moves'}
          </span>
        )}
        {hint && (
          <span className="hint-chip" role="status">
            Next: <strong>{formatMove(hint)}</strong>
          </span>
        )}
      </div>
      {solverError && <p className="error-text">{solverError}</p>}

      {scramble.length > 0 && (
        <details className="sequences">
          <summary>Scramble and moves</summary>
          <p className="sequence">
            <span className="label">Scramble</span>
            <code>{formatMoves(scramble)}</code>
          </p>
          {playerMoves.length > 0 && (
            <p className="sequence">
              <span className="label">Your moves</span>
              <code>
                {playerMoves.length > VISIBLE_MOVES && '… '}
                {formatMoves(playerMoves.slice(-VISIBLE_MOVES))}
              </code>
            </p>
          )}
        </details>
      )}

      <StatsRow />
    </section>
  );
}
