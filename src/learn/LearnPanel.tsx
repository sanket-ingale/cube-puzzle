import { ArrowLeft, Check, Play, RotateCw, X } from 'lucide-react';
import { formatMove, type Move } from '../cube/moves';
import { toFacelets } from '../cube/facelets';
import { useCubeStore } from '../game/store';
import { keyForMove } from '../keys/keymap';
import { SlicePicture } from '../keys/SlicePicture';
import { glideToFrame, nearestOf } from '../scene/view';
import { IconButton } from '../ui/IconButton';
import { useUi } from '../ui/uiStore';
import { NARROW_SCREEN, TOUCH_SCREEN, useMediaQuery } from '../ui/useMediaQuery';
import { heldMoves, STAGE_INDEX, type Step } from './lbl';
import {
  backToLessons,
  closeLearn,
  moreHelp,
  nextLesson,
  showMe,
  startLesson,
  STAGE_ORDER,
  useLearn,
  type LessonId,
} from './learn';
import { ALGORITHM_INFO, helpFor, lessonFor, LESSONS, NEXT_RUNG_LABEL } from './lessons';
import { ALGORITHMS } from './lbl';
import { framesWithTop, heldState } from './view';

/** One move as the player makes it: its notation as held, and the key (or button) for it. */
function MoveChip({ held, real, state }: { held: Move; real: Move; state: 'done' | 'now' | 'todo' }) {
  const frame = useUi((s) => s.viewFrame);
  const touch = useMediaQuery(TOUCH_SCREEN);
  const press = keyForMove(real, frame);
  return (
    <li className={`move-chip ${state}`}>
      <span className="move-chip-notation">{formatMove(held)}</span>
      {press && (
        <span className="move-chip-key" aria-hidden="true">
          <SlicePicture turnKey={press.key} reversed={press.reversed} />
          {!touch && <span className="move-chip-letter">{press.reversed ? `Space+${press.key.label}` : press.key.label}</span>}
          {press.times === 2 && <span className="twice">×2</span>}
        </span>
      )}
    </li>
  );
}

/** The step's moves in its three parts, with the player's progress through them. */
function MoveStrip({ step, made }: { step: Step; made: number }) {
  const real = useLearn((s) => s.moves);
  const setup = step.setup.length;
  const alg = step.algorithm?.moves.length ?? 0;
  const algEnd = setup + alg * step.times;
  const round = made >= setup && made < algEnd ? Math.floor((made - setup) / alg) : made >= algEnd ? step.times - 1 : 0;
  const held = heldMoves(step);
  const state = (i: number) => (i < made ? 'done' : i === made ? 'now' : 'todo');

  return (
    <div className="move-strip">
      {setup > 0 && (
        <div className="move-part">
          <span className="move-part-label">First</span>
          <ul className="move-chips">
            {step.setup.map((m, i) => (
              <MoveChip key={i} held={m} real={real[i]} state={state(i)} />
            ))}
          </ul>
        </div>
      )}
      {step.algorithm && (
        <div className="move-part">
          <span className="move-part-label">
            {ALGORITHM_INFO[step.algorithm.id].name}
            {step.times > 1 && <span className="rounds"> · {made >= algEnd ? step.times : round + 1} of {step.times}</span>}
          </span>
          <ul className="move-chips">
            {step.algorithm.moves.map((m, i) => {
              const at = setup + round * alg + i;
              return <MoveChip key={i} held={m} real={real[at]} state={made >= algEnd ? 'done' : state(at)} />;
            })}
          </ul>
        </div>
      )}
      {step.after.length > 0 && (
        <div className="move-part">
          <span className="move-part-label">Then</span>
          <ul className="move-chips">
            {step.after.map((m, i) => (
              <MoveChip key={i} held={m} real={real[algEnd + i]} state={state(algEnd + i)} />
            ))}
          </ul>
        </div>
      )}
      <p className="move-strip-note">
        Letters are as you hold the cube now: F is the face on the left, R the face on the right, U the top.
        {held.length > 0 && ' The next move is also shown by the arrow on the cube.'}
      </p>
    </div>
  );
}

function ToolCard({ id }: { id: keyof typeof ALGORITHM_INFO }) {
  const info = ALGORITHM_INFO[id];
  return (
    <div className="tool-card">
      <span className="tool-name">{info.name}</span>
      <code className="tool-moves">{ALGORITHMS[id].moves.map(formatMove).join(' ')}</code>
      <span className="tool-what">{info.what}</span>
    </div>
  );
}

function LessonMenu() {
  const completed = useLearn((s) => s.completed);
  const cubeStage = useLearn((s) => s.cubeStage);
  const scrambled = cubeStage !== 'done';

  return (
    <div className="learn-body">
      <p className="learn-intro">
        The beginner’s method solves the cube a layer at a time, in seven lessons. Each one has a
        goal. You do the turning, and ask for help only when you need it.
      </p>
      {scrambled && (
        <button type="button" className="secondary learn-continue" onClick={() => void startLesson(cubeStage as LessonId, false)}>
          <Play size={16} aria-hidden="true" /> Carry on with this cube: lesson {STAGE_INDEX[cubeStage] + 1}
        </button>
      )}
      <ol className="lesson-list">
        {LESSONS.map((lesson, i) => (
          <li key={lesson.id}>
            <button type="button" className="lesson-row" onClick={() => void startLesson(lesson.id, true)}>
              <span className={completed.includes(lesson.id) ? 'lesson-number done' : 'lesson-number'}>
                {completed.includes(lesson.id) ? <Check size={14} strokeWidth={3} aria-label="Done" /> : i + 1}
              </span>
              <span className="lesson-title">{lesson.title}</span>
              <span className="lesson-go">Practise</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="learn-note">Practise sets up a fresh cube with the earlier layers already done.</p>
    </div>
  );
}

function LessonView() {
  const learn = useLearn();
  const narrow = useMediaQuery(NARROW_SCREEN);
  const lessonId = learn.lesson!;
  const lesson = lessonFor(lessonId);
  const index = STAGE_INDEX[lessonId];
  const frame = useUi((s) => s.viewFrame);
  const cubies = useCubeStore((s) => s.cubies);
  const busy = useCubeStore((s) => s.mode !== 'play' || s.active !== null);
  const facelets = toFacelets(cubies);
  const yellowUp = heldState(facelets, frame)[4] === 'D';

  if (learn.preparing) {
    return (
      <div className="learn-body">
        <p className="learn-status">Setting up a practice cube…</p>
      </div>
    );
  }

  if (learn.stageDone) {
    const last = index === STAGE_ORDER.length - 1;
    return (
      <div className="learn-body">
        <p className="learn-done">
          <strong>{last ? 'Solved! You did the whole beginner’s method.' : 'Lesson done!'}</strong>{' '}
          {last ? 'Scramble and try it again on your own; hints are there if you get stuck.' : lesson.goal}
        </p>
        <div className="dialog-actions">
          {!last && (
            <button type="button" className="secondary primary-action" onClick={nextLesson}>
              Next: {lessonFor(STAGE_ORDER[index + 1]).title}
            </button>
          )}
          <button type="button" className="secondary" onClick={() => void startLesson(lessonId, true)}>
            <RotateCw size={16} aria-hidden="true" /> Practise again
          </button>
          <button type="button" className="secondary" onClick={backToLessons}>
            All lessons
          </button>
        </div>
      </div>
    );
  }

  const behind = STAGE_INDEX[learn.cubeStage] < index;
  if (behind) {
    const earlier = learn.cubeStage as LessonId;
    return (
      <div className="learn-body">
        <p className="learn-status">
          This cube isn’t ready for this lesson: <strong>{lessonFor(earlier).title}</strong> isn’t finished yet.
        </p>
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={() => void startLesson(earlier, false)}>
            Go to that lesson
          </button>
          <button type="button" className="secondary" onClick={() => void startLesson(lessonId, true)}>
            Practise this one
          </button>
        </div>
      </div>
    );
  }

  const step = learn.step;
  const help = step ? helpFor(step) : null;

  return (
    <div className="learn-body">
      <p className="learn-goal">
        <strong>Goal:</strong> {lesson.goal}
      </p>
      <details className="learn-idea" open={learn.steps === 0 && learn.rung === 0 && !narrow}>
        <summary>How it works</summary>
        <p>{lesson.idea}</p>
        {lesson.tools.map((id) => (
          <ToolCard key={id} id={id} />
        ))}
      </details>

      {!yellowUp && (
        <p className="learn-hold">
          Hold the cube with yellow on top.{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              const f = nearestOf(framesWithTop(facelets, 'D'));
              if (f) glideToFrame(f);
            }}
          >
            Turn it for me
          </button>
        </p>
      )}

      {step && help && (
        <div className="learn-help" aria-live="polite">
          {learn.rung === 0 && <p className="learn-try">Your turn. Ask for a hint whenever you like.</p>}
          {learn.rung >= 1 && <p>{help.piece}</p>}
          {learn.rung >= 2 && <p>{help.where}</p>}
          {learn.rung >= 3 && (
            <>
              <p>{help.how}</p>
              <MoveStrip step={step} made={learn.made} />
            </>
          )}
        </div>
      )}

      <div className="learn-actions">
        {learn.rung < 3 && (
          <button type="button" className="secondary primary-action" onClick={moreHelp} disabled={!step}>
            {NEXT_RUNG_LABEL[learn.rung]}
          </button>
        )}
        <button type="button" className="secondary" onClick={showMe} disabled={!step || busy}>
          <Play size={16} aria-hidden="true" /> Show me
        </button>
        {learn.steps > 0 && <span className="learn-count">{learn.steps} done</span>}
      </div>
    </div>
  );
}

/** Learn mode's panel: the lessons, then the lesson being done. */
export function LearnPanel() {
  const status = useLearn((s) => s.status);
  const lessonId = useLearn((s) => s.lesson);
  if (status === 'off') return null;
  const index = lessonId ? STAGE_INDEX[lessonId] : -1;

  return (
    <section className="panel learn" aria-label="Learn to solve">
      <header className="learn-head">
        {status === 'lesson' && (
          <IconButton icon={ArrowLeft} label="All lessons" variant="flat" onClick={backToLessons} />
        )}
        <div className="learn-heading">
          <span className="learn-kicker">{status === 'lesson' ? `Lesson ${index + 1} of ${STAGE_ORDER.length}` : 'Learn to solve'}</span>
          <h2 className="learn-title">{status === 'lesson' && lessonId ? lessonFor(lessonId).title : 'The beginner’s method'}</h2>
        </div>
        <IconButton icon={X} label="Stop learning" variant="flat" tip="below-end" onClick={closeLearn} />
      </header>
      {status === 'lesson' && (
        <ol className="learn-progress" aria-hidden="true">
          {STAGE_ORDER.map((id, i) => (
            <li key={id} className={i < index ? 'past' : i === index ? 'current' : ''} />
          ))}
        </ol>
      )}
      {status === 'menu' ? <LessonMenu /> : <LessonView />}
    </section>
  );
}
