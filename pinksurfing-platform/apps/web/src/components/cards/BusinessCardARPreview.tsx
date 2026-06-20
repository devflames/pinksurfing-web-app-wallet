'use client';

import { useState } from 'react';

export type BusinessCardARData = {
  name: string;
  credentials?: string;
  avatarUrl: string;
  aboutMe: string;
  dealsInterestedIn: string[];
};

type Props = {
  data: BusinessCardARData;
  /** Rendered business card — hover QR area to preview AR */
  children: React.ReactNode;
};

export function BusinessCardARPreview({ data, children }: Props) {
  const [scanning, setScanning] = useState(false);
  const displayName = data.credentials ? `${data.name} ${data.credentials}` : data.name;

  return (
    <div className="space-y-3">
      <div
        className="relative"
        onMouseLeave={() => setScanning(false)}
      >
        {children}

        <button
          type="button"
          className="absolute bottom-3 right-3 z-10 flex h-20 w-20 items-end justify-end rounded-lg sm:h-24 sm:w-24"
          onMouseEnter={() => setScanning(true)}
          onFocus={() => setScanning(true)}
          onBlur={() => setScanning(false)}
          onClick={() => setScanning((s) => !s)}
          aria-label="Preview AR scan overlay"
          title="Hover or tap QR — AR preview"
        />

        {scanning && (
          <div className="ps-bizcard-ar-overlay pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl p-3">
            <div className={`ps-bizcard-ar-panel w-full max-w-[280px]`}>
              <div className="mb-2 flex items-center justify-between text-[8px] uppercase tracking-widest text-[var(--ps-cyan)]">
                <span>PinkSurfing AR</span>
                <span className="text-[var(--ps-pink)]">Scanning…</span>
              </div>

              <div className="mb-2 flex items-center gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold leading-tight text-[var(--ps-white)]">
                    {displayName}
                  </div>
                  <div className="text-[9px] text-[var(--ps-dim)]">Printed card detected</div>
                </div>
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-[var(--ps-cyan)]/60 shadow-[0_0_12px_rgba(0,184,255,0.35)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={data.avatarUrl} alt="" className="h-full w-full object-cover" />
                </div>
              </div>

              <div className="mb-2 rounded-lg border border-[var(--ps-cyan)]/30 bg-[var(--ps-cyan)]/8 px-2.5 py-2">
                <div className="mb-0.5 text-[8px] font-semibold uppercase tracking-wide text-[var(--ps-cyan)]">
                  About me
                </div>
                <p className="text-[10px] leading-snug text-[var(--ps-white)]">{data.aboutMe}</p>
              </div>

              <div>
                <div className="mb-1 text-[8px] font-semibold uppercase tracking-wide text-[var(--ps-pink)]">
                  Deals interested in
                </div>
                <div className="flex flex-wrap gap-1">
                  {data.dealsInterestedIn.map((deal) => (
                    <span
                      key={deal}
                      className="rounded-full border border-[var(--ps-pink)]/35 bg-[var(--ps-pink)]/12 px-2 py-0.5 text-[9px] text-[var(--ps-white)]"
                    >
                      {deal}
                    </span>
                  ))}
                </div>
              </div>

              <p className="mt-2 text-center text-[8px] text-[var(--ps-dim)]">
                QR adds this business to your Business contacts in PinkSurfing
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-[9px] text-[var(--ps-dim)]">
        Hover or tap the QR to preview AR. Scanning the printed QR adds them to Business contacts.
      </p>
    </div>
  );
}
