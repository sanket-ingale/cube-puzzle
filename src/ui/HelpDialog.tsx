import type { ComponentType } from 'react';
import {
  Grid3x3,
  History,
  Hourglass,
  Lightbulb,
  Orbit,
  Redo2,
  RotateCcw,
  Shuffle,
  Undo2,
  WandSparkles,
  GraduationCap,
  type LucideProps,
} from 'lucide-react';
import { Dialog } from './Dialog';
import { useUi } from './uiStore';

const ICONS: { icon: ComponentType<LucideProps>; name: string; text: string }[] = [
  { icon: Shuffle, name: 'Scramble', text: 'Mixes the cube with 25 random turns and gets the timer ready.' },
  { icon: RotateCcw, name: 'Reset', text: 'Plays every move backwards until the cube is solved.' },
  { icon: Undo2, name: 'Undo', text: 'Takes back your last move. The scramble itself can’t be undone.' },
  { icon: Redo2, name: 'Redo', text: 'Puts back a move you undid.' },
  { icon: Lightbulb, name: 'Hint', text: 'Shows the next move of a short solution.' },
  { icon: WandSparkles, name: 'Solve it', text: 'Finishes the cube for you. The timed attempt is given up.' },
  { icon: GraduationCap, name: 'Guided solve', text: 'Walks you through a solve one move at a time, with an arrow on the layer to turn. A good place to start.' },
  { icon: Orbit, name: '2D view', text: 'Shows the cube as circles. On phones it swaps places with the 3D cube.' },
  { icon: Grid3x3, name: 'Move buttons', text: 'A button for every turn. The apostrophe button makes them turn counter-clockwise.' },
  { icon: Hourglass, name: 'Inspection', text: '15 seconds to study the cube after a scramble, as in competitions.' },
  { icon: History, name: 'History', text: 'Your past solves, with a button to replay each one.' },
];

const SHORTCUTS: [string, string][] = [
  ['U D L R F B', 'Turn a face clockwise'],
  ['M E S', 'Turn a middle slice'],
  ['Shift + letter', 'Turn counter-clockwise'],
  ['Space', 'Scramble'],
  ['H', 'Hint'],
  ['Ctrl/⌘ Z', 'Undo'],
  ['Ctrl/⌘ Shift Z', 'Redo'],
  ['?', 'This help'],
  ['Esc', 'Close a dialog'],
];

export function HelpDialog() {
  const open = useUi((s) => s.helpOpen);
  const setOpen = useUi((s) => s.setHelpOpen);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="How to play">
      <section className="help-section">
        <h3>New to the cube?</h3>
        <p>
          Press the <strong>Guided solve</strong> button (the graduation cap). It scrambles the
          cube and then shows you every move to make, with an arrow on the layer to turn. If you
          make a different move, it simply finds a new route from where you are.
        </p>
      </section>

      <section className="help-section">
        <h3>Turning layers</h3>
        <ul>
          <li>
            <strong>On the cube:</strong> press a sticker and drag it the way you want its layer to
            turn. Drag the empty space around the cube to look at it from another side, and pinch
            or scroll to zoom.
          </li>
          <li>
            <strong>In the 2D view:</strong> every circle is one layer, and every sticker sits where
            its two layers cross. Drag a sticker along a circle, or press a circle’s arrows, to turn
            that layer. The layer that is turning lights up in both views.
          </li>
          <li>
            <strong>With buttons or a keyboard:</strong> use the move buttons, or the letter keys
            listed below.
          </li>
        </ul>
      </section>

      <section className="help-section">
        <h3>Reading moves</h3>
        <p>
          Letters name layers: <b>U</b>p, <b>D</b>own, <b>L</b>eft, <b>R</b>ight, <b>F</b>ront and{' '}
          <b>B</b>ack, plus the middle slices <b>M</b>, <b>E</b> and <b>S</b>. A letter on its own is
          a clockwise quarter turn, as seen when looking at that face. An apostrophe (R′) turns it
          counter-clockwise, and a 2 (R2) is a half turn.
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
          {ICONS.map(({ icon: Icon, name, text }) => (
            <li key={name}>
              <span className="icon-chip" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span>
                <strong>{name}.</strong> {text}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="help-section">
        <h3>Keyboard shortcuts</h3>
        <table className="shortcuts">
          <tbody>
            {SHORTCUTS.map(([keys, action]) => (
              <tr key={keys}>
                <td>
                  <kbd>{keys}</kbd>
                </td>
                <td>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Dialog>
  );
}
