'use client';

import type { BusinessContactRequest } from '@/lib/business-contact-requests';

type Props = {
  request: BusinessContactRequest;
  onDismiss: () => void;
  onViewRequests?: () => void;
};

export function BusinessContactAcceptedAlert({ request, onDismiss, onViewRequests }: Props) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-labelledby="contact-accepted-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-[var(--ps-pink)]/45 bg-[var(--ps-card)] p-5 shadow-[0_24px_80px_rgba(151,71,255,0.35)]">
        <div className="mb-3 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ps-pink)]/15 text-2xl">
            🤝
          </span>
        </div>
        <h3
          id="contact-accepted-title"
          className="text-center text-sm font-semibold text-[var(--ps-white)]"
        >
          Business contact accepted
        </h3>
        <p className="mt-2 text-center text-[11px] leading-relaxed text-[var(--ps-muted)]">
          <span className="font-medium text-[var(--ps-white)]">{request.toBusinessName}</span>{' '}
          accepted your request. You can start a business chat anytime.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-full bg-[var(--ps-pink)] py-2.5 text-[11px] font-medium text-[var(--ps-card)]"
          >
            Great!
          </button>
          {onViewRequests && (
            <button
              type="button"
              onClick={() => {
                onViewRequests();
                onDismiss();
              }}
              className="w-full rounded-full border border-[var(--ps-brd)] py-2 text-[10px] text-[var(--ps-cyan)]"
            >
              View requests
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
