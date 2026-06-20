'use client';

import { PayChatDial } from './PayChatDial';

type Props = {
  open: boolean;
  step: number;
  accepting: boolean;
  onStepChange: (step: number) => void;
  onAcceptingChange: (accepting: boolean) => void;
  onClose: () => void;
};

export function PayChatDialOverlay({
  open,
  step,
  accepting,
  onStepChange,
  onAcceptingChange,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--ps-brd)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="PayChat rate dial"
      >
        <PayChatDial
          step={step}
          onStepChange={onStepChange}
          accepting={accepting}
          onAcceptingChange={onAcceptingChange}
          onBack={onClose}
        />
      </div>
    </div>
  );
}
