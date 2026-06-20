type Props = { size?: number; className?: string };

/** Plus sign with QR pattern behind — scan business card to add */
export function QrAddIcon({ size = 28, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="8" height="8" rx="1" fill="var(--ps-pink)" opacity="0.35" />
      <rect x="17" y="3" width="8" height="8" rx="1" fill="var(--ps-pink)" opacity="0.35" />
      <rect x="3" y="17" width="8" height="8" rx="1" fill="var(--ps-pink)" opacity="0.35" />
      <rect x="5" y="5" width="3" height="3" fill="var(--ps-pink)" opacity="0.6" />
      <rect x="19" y="5" width="3" height="3" fill="var(--ps-pink)" opacity="0.6" />
      <rect x="5" y="19" width="3" height="3" fill="var(--ps-pink)" opacity="0.6" />
      <rect x="17" y="17" width="8" height="8" rx="1" fill="var(--ps-cyan)" opacity="0.25" />
      <path
        d="M14 8v12M8 14h12"
        stroke="var(--ps-white)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
