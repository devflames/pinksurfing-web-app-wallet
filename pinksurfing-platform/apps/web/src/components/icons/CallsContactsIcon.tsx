type Props = { size?: number; className?: string };

/** Calls & contacts — dark card, cyan ring, white handset, pink accent */
export function CallsContactsIcon({ size = 28, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="var(--ps-card)" />
      <circle cx="16" cy="16" r="10" fill="var(--ps-surf)" stroke="var(--ps-cyan)" strokeWidth="1.5" />
      <path
        d="M12.2 13.8c.6 1.2 1.5 2.3 2.6 3.3 1 1 2.1 1.9 3.3 2.5l1.1-1.1c.2-.2.5-.3.8-.1.7.3 1.4.5 2.1.5.4 0 .8.3.8.8v1.7c0 .4-.4.8-.8.8-5.2 0-9.4-4.2-9.4-9.4 0-.4.3-.8.8-.8h1.7c.4 0 .8.3.8.8 0 .7.2 1.4.5 2.1.1.3 0 .6-.2.8l-1 1z"
        fill="var(--ps-white)"
      />
      <circle cx="24" cy="8" r="3" fill="var(--ps-pink)" />
    </svg>
  );
}
