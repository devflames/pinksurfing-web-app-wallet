'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  formatPaychatPrice,
  paychatKnobDegrees,
  paychatPriceForStep,
  PAYCHAT_STEPS,
} from '@/lib/paychat-pricing';

type Props = {
  step: number;
  onStepChange: (step: number) => void;
  accepting: boolean;
  onAcceptingChange: (accepting: boolean) => void;
  onBack?: () => void;
};

function clampStep(n: number): number {
  return Math.max(0, Math.min(PAYCHAT_STEPS - 1, Math.round(n)));
}

export function PayChatDial({ step, onStepChange, accepting, onAcceptingChange, onBack }: Props) {
  const knobRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'knob' | 'scroll'; lastAngle?: number; lastX?: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const price = paychatPriceForStep(step);
  const knobDeg = paychatKnobDegrees(step);
  const litTicks = step + 1;

  const setStep = useCallback(
    (next: number) => onStepChange(clampStep(next)),
    [onStepChange]
  );

  const angleFromPointer = useCallback((clientX: number, clientY: number) => {
    const el = knobRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rad = Math.atan2(clientY - cy, clientX - cx);
    let deg = (rad * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    return deg;
  }, []);

  const stepFromAngle = useCallback((deg: number) => {
    let start = 225;
    let delta = deg - start;
    if (delta < 0) delta += 360;
    if (delta > 270) delta = 270;
    return clampStep(Math.round((delta / 270) * (PAYCHAT_STEPS - 1)));
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;

      if (d.mode === 'knob') {
        const angle = angleFromPointer(e.clientX, e.clientY);
        if (d.lastAngle != null) {
          let diff = angle - d.lastAngle;
          if (diff > 180) diff -= 360;
          if (diff < -180) diff += 360;
          if (Math.abs(diff) > 0.5) {
            const next = clampStep(step + (diff > 0 ? 1 : -1) * Math.max(1, Math.round(Math.abs(diff) / 8)));
            setStep(next);
            d.lastAngle = angle;
          }
        } else {
          d.lastAngle = angle;
          setStep(stepFromAngle(angle));
        }
      } else if (d.mode === 'scroll' && d.lastX != null) {
        const dx = e.clientX - d.lastX;
        if (Math.abs(dx) > 2) {
          setStep(step + (dx > 0 ? 1 : -1));
          d.lastX = e.clientX;
        }
      }
    };

    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [angleFromPointer, setStep, step, stepFromAngle]);

  const ticks = Array.from({ length: PAYCHAT_STEPS }, (_, i) => {
    const angle = (i / PAYCHAT_STEPS) * 360 - 90;
    const lit = i < litTicks;
    return (
      <span
        key={i}
        className={`ps-paychat-tick ${lit ? 'ps-paychat-tick-lit' : ''}`}
        style={{ transform: `rotate(${angle}deg) translateY(-92px)` }}
      />
    );
  });

  const scrollOffset = (step / (PAYCHAT_STEPS - 1)) * 100;

  return (
    <div className="ps-paychat-dial flex flex-1 flex-col items-center px-4 py-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="ps-neu-pressed mb-4 flex h-9 w-9 items-center justify-center self-start rounded-full text-[var(--ps-white)]"
          aria-label="Back"
        >
          «
        </button>
      )}

      <h2 className="mb-6 font-serif text-lg tracking-[0.2em] text-[var(--ps-white)]">PINK SURFING</h2>

      <div className="ps-neu-inset mb-8 w-full max-w-[200px] rounded-2xl px-6 py-4 text-center">
        <div className="text-3xl font-bold tracking-tight text-[var(--ps-white)]">
          {formatPaychatPrice(price)}
        </div>
        <div className="mt-1 text-[9px] text-[var(--ps-dim)]">per message · one rate for all</div>
      </div>

      <div
        ref={knobRef}
        className={`ps-paychat-knob-wrap relative mb-8 ${dragging ? 'ps-paychat-knob-active' : ''}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = { mode: 'knob', lastAngle: angleFromPointer(e.clientX, e.clientY) };
          setDragging(true);
          setStep(stepFromAngle(angleFromPointer(e.clientX, e.clientY)));
        }}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={PAYCHAT_STEPS - 1}
        aria-valuenow={step}
        aria-label="PayChat price per message"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setStep(step + 1);
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setStep(step - 1);
        }}
      >
        <div className="ps-paychat-tick-ring">{ticks}</div>
        <div
          className="ps-paychat-knob"
          style={{ transform: `rotate(${knobDeg}deg)` }}
        >
          <span className="ps-paychat-knob-dot" />
        </div>
        <div className="ps-neu-pop absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full">
          <span className="text-xl font-bold text-[#ff1493]" style={{ textShadow: '0 0 12px rgba(255,20,147,0.6)' }}>
            $
          </span>
        </div>
      </div>

      <div className="mb-8 flex w-full max-w-[220px] gap-3">
        <button
          type="button"
          onClick={() => onAcceptingChange(true)}
          className={`ps-neu-toggle flex-1 rounded-xl py-2.5 text-[11px] font-semibold tracking-wider ${
            accepting ? 'ps-neu-toggle-on text-[var(--ps-cyan)]' : 'text-[var(--ps-dim)]'
          }`}
        >
          ON
        </button>
        <button
          type="button"
          onClick={() => onAcceptingChange(false)}
          className={`ps-neu-toggle flex-1 rounded-xl py-2.5 text-[11px] font-semibold tracking-wider ${
            !accepting ? 'ps-neu-toggle-on text-[var(--ps-dim)]' : 'text-[var(--ps-dim)]'
          }`}
        >
          OFF
        </button>
      </div>

      <p className="mb-3 max-w-xs text-center text-[9px] text-[var(--ps-dim)]">
        {accepting
          ? 'Incoming PayChats are open — everyone pays this same rate to message you.'
          : 'Incoming PayChats are off — you cannot be reached until you turn ON.'}
      </p>

      <div
        className="ps-neu-scroll-track w-full max-w-[280px] overflow-hidden rounded-2xl py-3"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = { mode: 'scroll', lastX: e.clientX };
          setDragging(true);
        }}
        role="slider"
        aria-label="Fine-tune price"
        tabIndex={0}
      >
        <div
          className="ps-neu-scroll-wheel flex gap-[3px] px-4 transition-transform duration-75"
          style={{
            transform: `translateX(${-scrollOffset * 1.2}px)`,
            width: 'max-content',
          }}
        >
          {Array.from({ length: PAYCHAT_STEPS * 2 }, (_, i) => (
            <span key={i} className="ps-neu-scroll-rib" />
          ))}
        </div>
      </div>
      <p className="mt-2 text-[8px] text-[var(--ps-dim)]">Drag knob clockwise · scroll bar left ↔ right</p>
    </div>
  );
}
