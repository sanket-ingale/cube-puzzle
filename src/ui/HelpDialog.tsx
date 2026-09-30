import type { ComponentType } from 'react';
import {
  History,
  Hourglass,
  Lightbulb,
  Redo2,
  RotateCcw,
  Shuffle,
  Sparkles,
  Undo2,
  WandSparkles,
  GraduationCap,
  Scan,
  type LucideProps,
} from 'lucide-react';
import { Dialog } from './Dialog';
import { useUi } from './uiStore';
import { CirclesIcon } from './CirclesIcon';
import { KeyChart } from '../keys/KeyChart';
import { TOUCH_SCREEN, useMediaQuery } from './useMediaQuery';

const ICONS: { icon: ComponentType<LucideProps>; name: string; text: string; primary?: boolean }[] = [
  { icon: Shuffle, name: 'Scramble', text: 'Mixes the cube with 25 random turns and gets the timer ready.', primary: true },
  { icon: RotateCcw, name: 'Reset', text: 'Plays every move backwards until the cube is solved.' },
  { icon: Undo2, name: 'Undo', text: 'Takes back your last move. The scramble itself can’t be undone.' },
  { icon: Redo2, name: 'Redo', text: 'Puts back a move you undid.' },
  { icon: Sparkles, name: 'Help me solve', text: 'On phones, opens the hint, solve and learn buttons.' },
  { icon: Lightbulb, name: 'Hint', text: 'Shows the next move of a short solution.' },
  { icon: WandSparkles, name: 'Solve it', text: 'Finishes the cube for you. The timed attempt is given up.' },
  { icon: GraduationCap, name: 'Learn to solve', text: 'Lessons in the beginner’s method, with help a step at a time. A good place to start.' },
  { icon: CirclesIcon, name: '2D view', text: 'Shows the cube as circles. On phones it swaps places with the 3D cube.' },
  { icon: Scan, name: 'Reset view', text: 'Appears once you tumble the cube to look around, and settles it on the nearest corner view.' },
  { icon: Hourglass, name: 'Inspection', text: '15 seconds to study the cube after a scramble, as in competitions.' },
  { icon: History, name: 'History', text: 'Your past solves, with a button to replay each one.' },
];

const SHORTCUTS: [string, string][] = [
  ['hold Space', 'Turn the other way: up, or to the left'],
  ['Enter', 'Scramble'],
  ['N', 'Hint'],
  ['Esc', 'Back to the corner view, or close a dialog'],
  ['Ctrl/⌘ Z', 'Undo'],
  ['Ctrl/⌘ Shift Z', 'Redo'],
  ['?', 'This help'],
];

export function HelpDialog() {
  const open = useUi((s) => s.helpOpen);
  const touch = useMediaQuery(TOUCH_SCREEN);
  const setOpen = useUi((s) => s.setHelpOpen);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="How to play">
      <section className="help-section">
        <h3>New to the cube?</h3>
        <p>
          Press <strong>Learn to solve</strong> (the graduation cap). Seven short lessons teach the
          beginner’s method, one layer at a time. Each gives you a goal and lets you try; when
          you’re stuck, ask for help a step at a time: which piece, where it goes, and how, with
          the algorithm to use. Practise any lesson on a fresh cube with the earlier layers done.
        </p>
      </section>

      <section className="help-section">
        <h3>Turning layers</h3>
        <ul>
          <li>
            <strong>On the cube:</strong> press a sticker and drag it the way you want its layer to
            turn. Drag the empty space around the cube to tumble it any way you like, even upside
            down, and pinch or scroll to zoom.
          </li>
          <li>
            <strong>In the 2D view:</strong> every circle is one layer, and every sticker sits where
            its two layers cross. Drag a sticker along a circle, or press a circle’s arrows, to turn
            that layer. The layer that is turning lights up in both views.
          </li>
          <li>
            <strong>{touch ? 'With the turn buttons:' : 'With the turn keys:'}</strong> see below.
          </li>
        </ul>
      </section>

      <section className="help-section">
        <h3>{touch ? 'Turn buttons' : 'Turn keys'}</h3>
        <p>
          The cube always settles on a corner: one face on the left, one on the right and one on
          top. {touch ? 'Nine buttons' : 'Nine keys'} turn its layers as you see them there. Each
          picture shows the slice that turns and the way it goes, and the layer lights up on the cube as it turns{touch ? '' : ' (hover over a key to see which layer it moves)'}:
        </p>
        <KeyChart letters={!touch} />
        <p>
          {touch ? (
            <>Tap Reverse to turn the other way; the arrows on the buttons flip to match.</>
          ) : (
            <>
              Hold <kbd>Space</kbd> to turn the other way; the arrows on the keys flip to match.
            </>
          )}{' '}
          Everything goes by position, never colour: the left face is whatever face is on the left
          right now. Tumble the cube to look around, and the next {touch ? 'tap' : 'key press'} (or
          Reset view{touch ? '' : ', or Esc'}) settles it on the nearest corner, which may have a
          different face on top; the {touch ? 'buttons' : 'keys'} follow it. Hints and lessons
          light up the {touch ? 'button to tap' : 'key to press'}.
          {!touch && ' Keys go by where they sit on the keyboard, so the layout is the same in any keyboard language.'}
        </p>
      </section>

      <section className="help-section">
        <h3>Reading moves</h3>
        <p>
          Letters name layers: <b>U</b>p, <b>D</b>own, <b>L</b>eft, <b>R</b>ight, <b>F</b>ront and{' '}
          <b>B</b>ack, plus the middle slices <b>M</b>, <b>E</b> and <b>S</b>. A letter on its own is
          a clockwise quarter turn, as seen when looking at that face. An apostrophe (R′) turns it
          counter-clockwise, and a 2 (R2) is a half turn: the same key or button twice. Hints show both the
          move and what to press.
        </p>
      </section>

      <section className="help-section">
        <h3>Timed solves</h3>
        <p>
          Scramble, and the clock starts with your first move and stops when the cube is solved.
          Your best time and averages of your last 5 and 12 solves (Ao5, Ao12) are kept on this
          device. As in competitions, each average drops the best and worst time. Solves that used
          a hint are saved but don’t count.
        </p>
      </section>

      <section className="help-section">
        <h3>Buttons</h3>
        <ul className="icon-guide">
          {ICONS.map(({ icon: Icon, name, text, primary }) => (
            <li key={name}>
              <span className={primary ? 'icon-chip primary' : 'icon-chip'} aria-hidden="true">
                <Icon size={18} />
              </span>
              <span>
                <strong>{name}.</strong> {text}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {!touch && (
        <section className="help-section">
          <h3>Keyboard shortcuts</h3>
          <table className="shortcuts">
            <tbody>
              {SHORTCUTS.map(([keys, action]) => (
                <tr key={keys}>
                  <td className="keys">
                    {keys.split(' ').map((k) => (k === 'hold' ? <span key={k}>hold </span> : <kbd key={k}>{k}</kbd>))}
                  </td>
                  <td>{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </Dialog>
  );
}
