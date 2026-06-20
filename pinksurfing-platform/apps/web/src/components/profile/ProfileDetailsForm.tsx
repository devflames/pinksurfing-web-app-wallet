'use client';

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
  placeholder?: string;
};

export function ProfileFormField({
  label,
  value,
  onChange,
  type = 'text',
  hint,
  placeholder,
}: FieldProps) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[10px] text-[var(--ps-muted)]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[var(--ps-brd)] bg-white px-3 py-2.5 text-[11px] text-black outline-none focus:ring-2 focus:ring-[var(--ps-cyan)]/40"
      />
      {hint && <p className="mt-1 text-[8px] leading-relaxed text-[var(--ps-dim)]">{hint}</p>}
    </div>
  );
}

export function ProfileFormCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-[var(--ps-cyan)]/25 bg-[var(--ps-cyan)]/8 px-3 py-2.5 text-[9px] leading-relaxed text-[var(--ps-muted)]">
      {children}
    </div>
  );
}

export function ProfileFormSaveBar({ onSave, onBack }: { onSave: () => void; onBack: () => void }) {
  return (
    <div className="sticky bottom-0 flex gap-2 border-t border-[var(--ps-brd)] bg-[var(--ps-surf)] p-3">
      <button
        type="button"
        onClick={onBack}
        className="rounded-lg border border-[var(--ps-brd)] px-4 py-2.5 text-[11px] text-[var(--ps-muted)]"
      >
        Back
      </button>
      <button
        type="button"
        onClick={onSave}
        className="flex-1 rounded-lg bg-black py-2.5 text-[11px] font-semibold uppercase tracking-wide text-white hover:bg-[#111]"
      >
        Save
      </button>
    </div>
  );
}
