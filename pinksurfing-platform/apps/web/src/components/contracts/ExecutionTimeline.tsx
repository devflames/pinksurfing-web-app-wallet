'use client';

import {
  TIMELINE_STEPS,
  type ExecutionTimelineData,
} from '@/lib/contract-timeline';

type Props = {
  timeline: ExecutionTimelineData;
  compact?: boolean;
};

export function ExecutionTimeline({ timeline, compact = false }: Props) {
  const visible = TIMELINE_STEPS.filter((step) => timeline[step.key]?.status !== 'skipped');

  return (
    <div className="flex flex-col">
      {visible.map((step, i) => {
        const t = timeline[step.key];
        const done = t?.status === 'completed';
        const isLast = i === visible.length - 1;
        return (
          <div key={step.key} className="flex items-start gap-2">
            <div className="flex flex-col items-center">
              <div
                className={`shrink-0 rounded-full border ${compact ? 'h-2 w-2 mt-1' : 'h-2.5 w-2.5 mt-0.5'}`}
                style={{
                  background: done ? step.color : 'rgba(255,255,255,0.08)',
                  borderColor: done ? step.color : 'rgba(255,255,255,0.15)',
                  boxShadow: done ? `0 0 8px ${step.color}55` : undefined,
                }}
              />
              {!isLast && (
                <div
                  className={`w-px flex-1 ${compact ? 'min-h-3 my-0.5' : 'min-h-4 my-0.5'}`}
                  style={{
                    background: done ? `${step.color}44` : 'rgba(255,255,255,0.06)',
                  }}
                />
              )}
            </div>
            <div
              className={`flex flex-1 items-center justify-between ${isLast ? '' : compact ? 'pb-2.5' : 'pb-3.5'}`}
            >
              <span
                className={`${compact ? 'text-[9px]' : 'text-[10px]'} ${done ? 'text-[var(--ps-white)]' : 'text-[var(--ps-dim)]'}`}
              >
                {step.label}
              </span>
              <span
                className={`text-[8px] font-medium ${done ? 'text-[var(--ps-green,#5DCAA5)]' : 'text-[var(--ps-dim)]'}`}
              >
                {done ? 'Completed' : 'Pending'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
