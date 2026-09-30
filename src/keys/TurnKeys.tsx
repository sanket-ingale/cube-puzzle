import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { useCubeStore } from '../game/store';
import { useCurrentHint } from '../solver/assist';
import { useGuide } from '../solver/guide';
import { useUi } from '../ui/uiStore';
import { keyForMove, TURN_KEYS, type TurnKey } from './keymap';
import { pressTurnKey } from './press';

// Named by position in the corner view, never by colour: colours move around as layers turn.
const GROUPS: { group: TurnKey['group']; title: string; short: string }[] = [
  { group: 'left', title: 'Left face columns', short: 'Left face' },
  { group: 'right', title: 'Right face columns', short: 'Right face' },
  { group: 'rows', title: 'Rows', short: 'Rows' },
];

// A tiny cube seen from the corner, with the part each group turns filled in.
const TOP = '0,-1 0.87,-0.5 0,0 -0.87,-0.5';
const LEFT = '-0.87,-0.5 0,0 0,1 -0.87,0.5';
const RIGHT = '0,0 0.87,-0.5 0.87,0.5 0,1';
const BAND = '-0.87,-0.17 0,0.33 0.87,-0.17 0.87,0.17 0,0.67 -0.87,0.17';

function PartIcon({ group }: { group: TurnKey['group'] }) {
  const fill = (part: TurnKey['group']) => (part === group ? 'var(--accent)' : 'none');
  return (
    <svg className="part-icon" width="16" height="16" viewBox="-1.1 -1.1 2.2 2.2" aria-hidden="true">
      <polygon points={TOP} fill="none" />
      <polygon points={LEFT} fill={fill('left')} />
      <polygon points={RIGHT} fill={fill('right')} />
      {group === 'rows' && <polygon points={BAND} fill="var(--accent)" />}
    </svg>
  );
}

/**
 * The turn keys: a keyboard guide and, on touch screens, the buttons themselves. Keys light up
 * as they're typed, the arrows flip while Space is held (or the reverse key is on), and the key
 * for the current hint or guide step is marked.
 */
export function TurnKeys() {
  const spaceHeld = useUi((s) => s.spaceHeld);
  const latched = useUi((s) => s.reverseLatched);
  const toggleReverse = useUi((s) => s.toggleReverse);
  const playing = useCubeStore((s) => s.mode === 'play');
  const hint = useCurrentHint();
  const guideMove = useGuide((s) => (s.status === 'ready' ? s.plan[0] : null));
  const [lit, setLit] = useState<string | null>(null);
  const reversed = spaceHeld || latched;
  const next = guideMove ?? hint;
  const hinted = next ? keyForMove(next) : null;

  useEffect(() => {
    let timeout = 0;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !TURN_KEYS.some((k) => k.code === e.code)) return;
      setLit(e.code);
      clearTimeout(timeout);
      timeout = window.setTimeout(() => setLit(null), 160);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(timeout);
    };
  }, []);

  const arrow = (group: TurnKey['group']) => {
    const Icon = group === 'rows' ? (reversed ? ArrowLeft : ArrowRight) : reversed ? ArrowUp : ArrowDown;
    return <Icon className="key-arrow" size={16} strokeWidth={2.5} aria-hidden="true" />;
  };
  const direction = (group: TurnKey['group']) =>
    group === 'rows' ? (reversed ? 'to the left' : 'to the right') : reversed ? 'up' : 'down';

  return (
    <section className={reversed ? 'panel turn-keys reversed' : 'panel turn-keys'} aria-label="Turn keys">
      <p className="turn-keys-title">Turn keys</p>
      <div className="key-groups">
        {GROUPS.map(({ group, title, short }) => (
          <div key={group} className="key-group">
            <span className="key-caption">
              <PartIcon group={group} />
              <span className="long">{title}</span>
              <span className="short">{short}</span>
              {arrow(group)}
            </span>
            <span className="key-set">
              {TURN_KEYS.filter((k) => k.group === group).map((k) => {
                const isHinted = hinted?.key.code === k.code;
                const classes = ['move', 'turn-key', lit === k.code && 'lit', isHinted && 'hinted'];
                return (
                  <button
                    key={k.code}
                    type="button"
                    className={classes.filter(Boolean).join(' ')}
                    disabled={!playing}
                    aria-label={`${k.label}: ${title.toLowerCase()}, ${k.part}, ${direction(group)}`}
                    onClick={() => pressTurnKey(k.code)}
                  >
                    {k.label}
                    {isHinted && hinted.times === 2 && <span className="twice">×2</span>}
                  </button>
                );
              })}
            </span>
          </div>
        ))}
        <button
          type="button"
          className={hinted?.reversed && !reversed ? 'move reverse-key hinted' : 'move reverse-key'}
          aria-pressed={reversed}
          aria-label="Reverse: turn the other way (or hold Space)"
          onClick={toggleReverse}
        >
          <kbd>Space</kbd>
          <span>{reversed ? 'Reversed' : 'Reverse'}</span>
        </button>
      </div>
      <ul className="turn-keys-foot">
        <li>
          <kbd>Enter</kbd> scramble
        </li>
        <li>
          <kbd>N</kbd> hint
        </li>
        <li>
          <kbd>Esc</kbd> reset view
        </li>
      </ul>
    </section>
  );
}
