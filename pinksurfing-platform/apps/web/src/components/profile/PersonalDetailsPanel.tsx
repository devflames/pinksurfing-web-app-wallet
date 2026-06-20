'use client';

import { useState } from 'react';
import type { SessionUser } from '@/lib/types/user';
import {
  loadPersonalDetails,
  savePersonalDetails,
  type PersonalDetails,
} from '@/lib/profile-settings-storage';
import {
  ProfileFormCallout,
  ProfileFormField,
  ProfileFormSaveBar,
} from '@/components/profile/ProfileDetailsForm';

type Props = {
  user: SessionUser | null;
  onBack: () => void;
  onSaved?: () => void;
  fullPage?: boolean;
};

export function PersonalDetailsPanel({ user, onBack, onSaved, fullPage = false }: Props) {
  const email = user?.email ?? 'guest';
  const [form, setForm] = useState<PersonalDetails>(() => loadPersonalDetails(user));

  const set = (key: keyof PersonalDetails, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = () => {
    savePersonalDetails(email, form);
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
          Personal Details
        </h2>
        <span className="w-9" />
      </div>

      <div className="ps-scroll min-h-0 flex-1 overflow-y-auto py-3">
        <ProfileFormCallout>
          <strong className="text-[var(--ps-white)]">Personal contacts</strong> find you by your{' '}
          <strong className="text-[var(--ps-cyan)]">mobile number</strong> and/or{' '}
          <strong className="text-[var(--ps-cyan)]">personal email</strong>. Keep these accurate so
          friends and family can add you on PinkSurfing without a business card.
        </ProfileFormCallout>

        <ProfileFormField
          label="Last Name"
          value={form.lastName}
          onChange={(v) => set('lastName', v)}
          hint="Change your legal name by verifying an ID document."
        />
        <ProfileFormField
          label="Date of Birth"
          value={form.dateOfBirth}
          onChange={(v) => set('dateOfBirth', v)}
          placeholder="MM-DD-YYYY"
        />
        <ProfileFormField
          label="Personal Mobile Number"
          value={form.mobilePhone}
          onChange={(v) => set('mobilePhone', v)}
          type="tel"
          hint="Used when someone adds you from their phone contacts."
        />
        <ProfileFormField
          label="Personal Email"
          value={form.personalEmail}
          onChange={(v) => set('personalEmail', v)}
          type="email"
          hint="Optional second way for personal contacts to find and invite you."
        />
        <ProfileFormField
          label="Street Address"
          value={form.streetAddress}
          onChange={(v) => set('streetAddress', v)}
        />
        <ProfileFormField label="Unit #" value={form.unit} onChange={(v) => set('unit', v)} />
        <ProfileFormField label="City / Town" value={form.city} onChange={(v) => set('city', v)} />
        <ProfileFormField label="Postcode" value={form.postcode} onChange={(v) => set('postcode', v)} />
        <ProfileFormField label="State" value={form.state} onChange={(v) => set('state', v)} />
        <ProfileFormField label="Country" value={form.country} onChange={(v) => set('country', v)} />
      </div>

      <ProfileFormSaveBar onSave={save} onBack={onBack} />
    </div>
  );
}
