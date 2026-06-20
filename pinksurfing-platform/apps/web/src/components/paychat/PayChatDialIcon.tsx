'use client';

import { paychatKnobDegrees, PAYCHAT_STEPS } from '@/lib/paychat-pricing';

const MINI_TICKS = 16;
const MINI_RADIUS = 13;

type Props = {
  step: number;
  accepting: boolean;
  onClick: () => void;
};

export function PayChatDialIcon({ step, accepting, onClick }: Props) {
  const knobDeg = paychatKnobDegrees(step);
  const litTicks = Math.max(1, Math.round(((step + 1) / PAYCHAT_STEPS) * MINI_TICKS));

  const ticks = Array.from({ length: MINI_TICKS }, (_, i) => {
    const angle = (i / MINI_TICKS) * 360;
    const lit = i < litTicks;
    return (
      <span
        key={i}
        className={`ps-paychat-tick-mini ${lit ? 'ps-paychat-tick-mini-lit' : ''}`}
        style={{
          transform: `rotate(${angle}deg) translateY(-${MINI_RADIUS}px)`,
        }}
      />
    );
  });

  return (
    <button
      type="button"
      onClick={onClick}
      className="ps-paychat-dial-btn flex w-full min-w-0 flex-col items-center justify-center py-1 transition-opacity hover:opacity-90"
      title={`Your PayChat rate · ${accepting ? 'ON' : 'OFF'} — tap to adjust`}
      aria-label="Open PayChat rate dial"
    >
      <div className="ps-paychat-dial-icon">
        <div className="ps-paychat-tick-ring-mini">{ticks}</div>
        <div
          className="ps-paychat-knob-mini-wrap"
          style={{ transform: `translate(-50%, -50%) rotate(${knobDeg}deg)` }}
        >
          <div className="ps-paychat-knob-mini">
            <span className="ps-paychat-knob-dot-mini" />
          </div>
        </div>
        <div className="ps-neu-pop-mini">
          <span className="text-[8px] font-bold text-[#ff1493]">$</span>
        </div>
      </div>
      <span className="mt-0.5 text-[8px] leading-none text-[var(--ps-dim)]">Rate</span>
    </button>
  );
}
