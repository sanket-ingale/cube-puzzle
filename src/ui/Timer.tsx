import { useEffect, useRef } from 'react';
import { INSPECTION_MS, useCubeStore } from '../game/store';
import { formatTime } from '../game/stats';

type TimerState = 'idle' | 'ready' | 'inspecting' | 'running' | 'done';

const HINTS: Record<TimerState, string> = {
  idle: 'Scramble to start a timed solve',
  ready: 'Starts on your first move',
  inspecting: 'Inspection: the clock starts on your first move, or at 0',
  running: 'Solve the cube to stop the clock',
  done: 'Final time',
};

export function Timer() {
  const timerStart = useCubeStore((s) => s.timerStart);
  const inspectionStart = useCubeStore((s) => s.inspectionStart);
  const lastSolve = useCubeStore((s) => s.lastSolve);
  const ready = useCubeStore((s) => s.mode === 'play' && s.scramble.length > 0 && !s.attemptDone);
  const box = useRef<HTMLDivElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const hint = useRef<HTMLSpanElement>(null);

  const state: TimerState =
    timerStart !== null
      ? 'running'
      : inspectionStart !== null
        ? 'inspecting'
        : lastSolve
          ? 'done'
          : ready
            ? 'ready'
            : 'idle';

  // While the clock or the inspection countdown runs, the display is updated directly each
  // frame instead of re-rendering React. When inspection runs out, the clock takes over.
  useEffect(() => {
    if (state !== 'running' && state !== 'inspecting') return;
    let frame = 0;
    const tick = () => {
      const now = Date.now();
      let text: string;
      let running = timerStart !== null;
      if (timerStart !== null) {
        text = formatTime(now - timerStart);
      } else {
        const left = INSPECTION_MS - (now - inspectionStart!);
        running = left <= 0;
        text = running ? formatTime(-left) : String(Math.ceil(left / 1000));
      }
      if (time.current) time.current.textContent = text;
      if (box.current) box.current.className = `timer ${running ? 'running' : 'inspecting'}`;
      if (hint.current) hint.current.textContent = HINTS[running ? 'running' : 'inspecting'];
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [state, timerStart, inspectionStart]);

  const text = lastSolve ? formatTime(lastSolve.timeMs) : '0.00';

  return (
    // Keyed so React replaces anything the running clock wrote directly.
    <div key={`${state}-${text}`} ref={box} className={`timer ${state}`}>
      <span ref={time} className="time" aria-live="off">
        {text}
      </span>
      <span ref={hint} className="timer-hint">
        {HINTS[state]}
      </span>
    </div>
  );
}
