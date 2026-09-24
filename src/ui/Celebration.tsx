import { useEffect, useRef } from 'react';
import { Trophy, X } from 'lucide-react';
import { paletteFor } from '../cube/colors';
import { usePersonalBest } from '../game/personalBest';
import { formatTime, type RecordKind } from '../game/stats';
import { IconButton } from './IconButton';
import { usePrefs } from './prefs';

const LABELS: Record<RecordKind, string> = {
  single: 'New best time',
  ao5: 'New best average of 5',
  ao12: 'New best average of 12',
};

const SHOW_MS = 6000;
const CONFETTI_MS = 2400;

/** A short burst of confetti in the cube's colours, drawn on a canvas taps pass through. */
function Confetti({ burst }: { burst: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const highContrast = usePrefs((s) => s.highContrast);

  useEffect(() => {
    const el = canvas.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = window.innerWidth * dpr;
    el.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const colours = Object.values(paletteFor(highContrast));
    const pieces = Array.from({ length: 140 }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: window.innerHeight * 0.3,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 9 - 3,
      size: 5 + Math.random() * 6,
      spin: Math.random() * Math.PI,
      colour: colours[Math.floor(Math.random() * colours.length)],
    }));

    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalAlpha = Math.max(0, 1 - t / CONFETTI_MS);
      for (const p of pieces) {
        p.vy += 0.25;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.spin += 0.2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.colour;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (t < CONFETTI_MS) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [burst, highContrast]);

  return <canvas ref={canvas} className="confetti" aria-hidden="true" />;
}

/** Celebrates a new personal best with a message, confetti, and (elsewhere) a chime. */
export function Celebration() {
  const celebration = usePersonalBest((s) => s.celebration);
  const dismiss = usePersonalBest((s) => s.dismiss);

  useEffect(() => {
    if (!celebration) return;
    const timeout = setTimeout(dismiss, SHOW_MS);
    return () => clearTimeout(timeout);
  }, [celebration, dismiss]);

  if (!celebration) return null;
  return (
    <>
      <Confetti burst={celebration.id} />
      <div className="celebration" role="status">
        <span className="celebration-icon" aria-hidden="true">
          <Trophy size={22} />
        </span>
        <div className="celebration-text">
          {celebration.records.map((r) => (
            <p key={r.kind}>
              <strong>{LABELS[r.kind]}!</strong> {formatTime(r.value)}{' '}
              <span className="muted">(was {formatTime(r.previous)})</span>
            </p>
          ))}
        </div>
        <IconButton icon={X} label="Dismiss" onClick={dismiss} />
      </div>
    </>
  );
}
