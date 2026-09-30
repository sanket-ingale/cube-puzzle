import { useEffect, useState } from 'react';
import { ArrowDown, ArrowDownUp, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { useCubeStore } from '../game/store';
import { useCurrentHint } from '../solver/assist';
import { useLearnNextMove } from '../learn/learn';
import { useUi } from '../ui/uiStore';
import { TOUCH_SCREEN, useMediaQuery } from '../ui/useMediaQuery';
import { SlicePicture } from './SlicePicture';
import { keyForMove, TURN_KEYS, type TurnKey } from './keymap';
import { pressTurnKey, previewTurnKey } from './press';

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
 * The turn keys. Each is drawn as a small cube with its slice and direction; with a keyboard
 * the key's letter sits under the picture and keys light up as they're typed, and on touch
 * screens the pictures are the buttons. The arrows flip while Space is held or Reverse is on, and the key for the current
 * hint or lesson step is marked. Everything is relative to the current corner view.
 */
export function TurnKeys() {
  const spaceHeld = useUi((s) => s.spaceHeld);
  const latched = useUi((s) => s.reverseLatched);
  const toggleReverse = useUi((s) => s.toggleReverse);
  const playing = useCubeStore((s) => s.mode === 'play');
  const hint = useCurrentHint();
  const guideMove = useLearnNextMove();
  const [lit, setLit] = useState<string | null>(null);
  const frame = useUi((s) => s.viewFrame);
  const touch = useMediaQuery(TOUCH_SCREEN);
  const reversed = spaceHeld || latched;
  const next = guideMove ?? hint;
  const hinted = next ? keyForMove(next, frame) : null;

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
      <p className="turn-keys-title">{touch ? 'Turns' : 'Turn keys'}</p>
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
                const classes = ['move', 'turn-key', 'picture', !touch && 'with-letter', lit === k.code && 'lit', isHinted && 'hinted'];
                const name = `${title.toLowerCase()}, ${k.part}, ${direction(group)}`;
                return (
                  <button
                    key={k.code}
                    type="button"
                    className={classes.filter(Boolean).join(' ')}
                    disabled={!playing}
                    aria-label={touch ? name : `${k.label}: ${name}`}
                    onClick={() => pressTurnKey(k.code)}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && previewTurnKey(k.code)}
                    onPointerLeave={() => previewTurnKey(null)}
                  >
                    <SlicePicture turnKey={k} reversed={reversed} />
                    {!touch && <span className="key-letter">{k.label}</span>}
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
          aria-label={touch ? 'Reverse: turn the other way' : 'Reverse: turn the other way (or hold Space)'}
          onClick={toggleReverse}
        >
          {touch ? <ArrowDownUp size={18} strokeWidth={2.5} aria-hidden="true" /> : <kbd>Space</kbd>}
          <span>{reversed ? 'Reversed' : 'Reverse'}</span>
        </button>
      </div>
      {!touch && (
        <ul className="turn-keys-foot">
          <li>
            <kbd>Enter</kbd> Scramble
          </li>
          <li>
            <kbd>N</kbd> Hint
          </li>
          <li>
            <kbd>Esc</kbd> Reset view
          </li>
        </ul>
      )}
    </section>
  );
}
