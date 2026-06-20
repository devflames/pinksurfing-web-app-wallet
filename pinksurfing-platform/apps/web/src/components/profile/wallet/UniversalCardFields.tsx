'use client';

import type { WalletCardUniversal } from '@/lib/wallet-card-universal';
import { WALLET_CATEGORY_OPTIONS } from '@/lib/wallet-card-universal';

const inputClass =
  'w-full rounded-lg border border-[var(--ps-brd)] bg-black px-3 py-2 text-[11px] text-[var(--ps-white)] outline-none focus:border-[var(--ps-cyan)]/50';

function PhotoUpload({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onChange(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div>
      <label className="mb-0.5 block text-[10px] text-[var(--ps-dim)]">{label}</label>
      {hint && <p className="mb-1 text-[9px] text-[var(--ps-muted)]">{hint}</p>}
      {value ? (
        <div className="relative mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="max-h-36 w-full rounded-lg border border-[var(--ps-brd)] object-contain"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[9px] text-[var(--ps-muted)]"
          >
            Remove
          </button>
        </div>
      ) : null}
      <label className="inline-flex cursor-pointer rounded-lg border border-dashed border-[var(--ps-brd)] px-3 py-2 text-[10px] text-[var(--ps-cyan)] hover:border-[var(--ps-cyan)]/40">
        {value ? 'Replace photo' : 'Upload / scan photo'}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      </label>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-3 py-2.5">
      <div>
        <div className="text-[10px] text-[var(--ps-white)]">{label}</div>
        {hint && <div className="text-[9px] text-[var(--ps-dim)]">{hint}</div>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-[var(--ps-pink)]"
      />
    </label>
  );
}

type Props = {
  value: WalletCardUniversal;
  onChange: (next: WalletCardUniversal) => void;
};

export function UniversalCardFields({ value, onChange }: Props) {
  const set = <K extends keyof WalletCardUniversal>(key: K, v: WalletCardUniversal[K]) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--ps-pink)]/25 bg-[var(--ps-surf)] px-3 py-2">
        <div className="text-[10px] font-semibold text-[var(--ps-pink)]">Memory + action</div>
        <p className="text-[9px] leading-relaxed text-[var(--ps-muted)]">
          Your note to self appears in ocean blue on every card — real context you care about,
          not obvious filler.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Card nickname *</label>
        <input
          value={value.nickname}
          onChange={(e) => set('nickname', e.target.value)}
          placeholder='e.g. Costco, AAA, Mom insurance'
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Category</label>
        <select
          value={value.category}
          onChange={(e) => set('category', e.target.value as WalletCardUniversal['category'])}
          className={inputClass}
        >
          {WALLET_CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <PhotoUpload
        label="Front photo"
        hint="Show or scan at the register, front desk, or gate."
        value={value.frontPhoto}
        onChange={(v) => set('frontPhoto', v)}
      />

      <PhotoUpload
        label="Back photo"
        hint="Capture barcodes, phone numbers, and terms on the back."
        value={value.backPhoto}
        onChange={(v) => set('backPhoto', v)}
      />

      <div>
        <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Barcode / scan data</label>
        <input
          value={value.barcodeData}
          onChange={(e) => set('barcodeData', e.target.value)}
          placeholder="Membership # or barcode digits for quick QR display"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Member / card number</label>
        <input
          value={value.memberNumber}
          onChange={(e) => set('memberNumber', e.target.value)}
          placeholder="Searchable reference number"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Expiration date</label>
        <input
          type="date"
          value={value.expirationDate}
          onChange={(e) => set('expirationDate', e.target.value)}
          className={inputClass}
        />
      </div>

      <Toggle
        label="Renewal reminder"
        hint="Alert 30 days before this card expires."
        checked={value.renewalReminder}
        onChange={(v) => set('renewalReminder', v)}
      />

      <div>
        <label className="mb-1 block text-[10px] font-semibold text-[var(--ps-cyan)]">Notes to self</label>
        <p className="mb-1.5 text-[9px] text-[var(--ps-dim)]">
          Shown in ocean blue on your card — e.g. &quot;remember to use points&quot;, &quot;Mom&apos;s card — shared with wife&quot;.
        </p>
        <textarea
          value={value.notesToSelf}
          onChange={(e) => set('notesToSelf', e.target.value)}
          placeholder="What matters about this card?"
          rows={3}
          className={`${inputClass} border-[var(--ps-cyan)]/25 focus:border-[var(--ps-cyan)]/60`}
        />
      </div>

      <Toggle
        label="Shared with family"
        hint="Spouse, parent, or caregiver can access this card."
        checked={value.sharedWithFamily}
        onChange={(v) => set('sharedWithFamily', v)}
      />

      {value.sharedWithFamily && (
        <div>
          <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Shared with</label>
          <input
            value={value.sharedWithNames}
            onChange={(e) => set('sharedWithNames', e.target.value)}
            placeholder='e.g. "wife", "Mom", "caregiver"'
            className={inputClass}
          />
        </div>
      )}

      <Toggle
        label="Private / locked"
        hint="Sensitive cards hide numbers until you reveal them."
        checked={value.isPrivate}
        onChange={(v) => set('isPrivate', v)}
      />
    </div>
  );
}
