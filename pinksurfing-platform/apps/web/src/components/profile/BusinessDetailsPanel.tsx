'use client';

import { useState } from 'react';
import type { SessionUser } from '@/lib/types/user';
import {
  loadBusinessDetails,
  saveBusinessDetails,
  type BusinessDetails,
} from '@/lib/profile-settings-storage';
import {
  ProfileFormCallout,
  ProfileFormField,
  ProfileFormSaveBar,
} from '@/components/profile/ProfileDetailsForm';
import {
  COLD_CONTACT_OPTIONS,
  type ColdContactLikelihood,
} from '@/lib/cold-contact-likelihood';

type Props = {
  user: SessionUser | null;
  onBack: () => void;
  onSaved?: () => void;
  fullPage?: boolean;
};

export function BusinessDetailsPanel({ user, onBack, onSaved, fullPage = false }: Props) {
  const email = user?.email ?? 'guest';
  const [form, setForm] = useState<BusinessDetails>(() => loadBusinessDetails(user));

  const set = (key: keyof BusinessDetails, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const setLikelihood = (value: ColdContactLikelihood) => {
    setForm((f) => ({ ...f, coldContactLikelihood: value }));
  };

  const save = () => {
    saveBusinessDetails(email, form);
    onSaved?.();
    onBack();
  };

  return (
    <div
      className={
        fullPage
          ? 'flex min-h-[min(100%,720px)] flex-col'
          : 'flex max-h-[min(70vh,640px)] flex-col overflow-hidden rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)]'
      }
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--ps-brd)] px-0 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ps-brd)] text-[var(--ps-white)]"
        >
          ←
        </button>
        <h2 className="flex-1 text-[15px] font-semibold text-[var(--ps-white)]">
          Business Details
        </h2>
        <span className="w-9" />
      </div>

      <div className="ps-scroll min-h-0 flex-1 overflow-y-auto py-3">
        <ProfileFormCallout>
          <strong className="text-[var(--ps-white)]">Business contacts</strong> connect by scanning
          your <strong className="text-[var(--ps-pink)]">business card QR</strong> or using your{' '}
          <strong className="text-[var(--ps-pink)]">business email</strong>. These fields appear on
          your card and in business search — not your personal cell.
        </ProfileFormCallout>

        <ProfileFormField
          label="Country Code"
          value={form.countryCode}
          onChange={(v) => set('countryCode', v)}
        />
        <ProfileFormField
          label="Business Name"
          value={form.businessName}
          onChange={(v) => set('businessName', v)}
        />
        <ProfileFormField
          label="Business Phone No"
          value={form.businessPhone}
          onChange={(v) => set('businessPhone', v)}
          type="tel"
        />
        <ProfileFormField
          label="Business Email Id"
          value={form.businessEmail}
          onChange={(v) => set('businessEmail', v)}
          type="email"
        />
        <ProfileFormField
          label="Business Web Site"
          value={form.website}
          onChange={(v) => set('website', v)}
          placeholder="www.example.com"
        />
        <ProfileFormField
          label="Business Address"
          value={form.streetAddress}
          onChange={(v) => set('streetAddress', v)}
        />
        <ProfileFormField label="Unit #" value={form.unit} onChange={(v) => set('unit', v)} />
        <ProfileFormField label="City / Town" value={form.city} onChange={(v) => set('city', v)} />
        <ProfileFormField label="Postcode" value={form.postcode} onChange={(v) => set('postcode', v)} />
        <ProfileFormField label="Country" value={form.country} onChange={(v) => set('country', v)} />
        <ProfileFormField label="State" value={form.state} onChange={(v) => set('state', v)} />

        <div className="mx-4 mb-4 mt-2 border-t border-[var(--ps-brd)] pt-4">
          <div className="mb-2 text-[11px] font-medium text-[var(--ps-white)]">
            Cold business contacts
          </div>
          <p className="mb-3 text-[9px] leading-relaxed text-[var(--ps-dim)]">
            When someone finds you on Home → Find, how open are you to a direct business request
            without an intro?
          </p>
          <div className="space-y-2">
            {COLD_CONTACT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLikelihood(opt.value)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all ${
                  form.coldContactLikelihood === opt.value
                    ? 'border-[var(--ps-pink)]/50 bg-[var(--ps-pink)]/10'
                    : 'border-[var(--ps-brd)] bg-[var(--ps-surf)] hover:border-[var(--ps-pink)]/30'
                }`}
              >
                <div className="text-[10px] font-medium text-[var(--ps-white)]">{opt.title}</div>
                <div className="mt-0.5 text-[8px] leading-snug text-[var(--ps-dim)]">
                  {opt.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <ProfileFormSaveBar onSave={save} onBack={onBack} />
    </div>
  );
}
