'use client';

import type { FieldDef } from '@/lib/wallet-card-types';

const inputClass =
  'w-full rounded-lg border border-[var(--ps-brd)] bg-black px-3 py-2 text-[11px] text-[var(--ps-white)] outline-none focus:border-[var(--ps-cyan)]/50';

type Props = {
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
};

function PhotoField({
  label,
  value,
  onChange,
}: {
  label: string;
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
      <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">{label}</label>
      {value ? (
        <div className="relative mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="max-h-32 w-full rounded-lg border border-[var(--ps-brd)] object-contain"
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
        {value ? 'Replace photo' : 'Upload photo'}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      </label>
    </div>
  );
}

export function CardFieldForm({ fields, values, onChange }: Props) {
  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const kind = field.kind ?? 'text';
        const value = values[field.key] ?? '';

        if (kind === 'photo') {
          return (
            <PhotoField
              key={field.key}
              label={field.label}
              value={value}
              onChange={(v) => onChange(field.key, v)}
            />
          );
        }

        return (
          <div key={field.key}>
            <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">
              {field.label}
              {field.required ? ' *' : ''}
            </label>
            {kind === 'textarea' ? (
              <textarea
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                className={`${inputClass} resize-y`}
              />
            ) : kind === 'select' ? (
              <select
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                className={inputClass}
              >
                <option value="">Select…</option>
                {field.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={kind === 'password' ? 'password' : kind === 'date' ? 'date' : kind}
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className={inputClass}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
