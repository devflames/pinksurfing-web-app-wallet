type Props = { size?: number; className?: string };

/** Network share — three nodes with curved connectors */
export function ShareIcon({ size = 20, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="6" cy="12" r="3.2" fill="#1e293b" />
      <circle cx="18" cy="6" r="3.2" fill="#1e293b" />
      <circle cx="18" cy="18" r="3.2" fill="#1e293b" />
      <path
        d="M8.8 10.8c2.2-1.4 4.2-2.2 6.2-2.5M8.8 13.2c2.2 1.4 4.2 2.2 6.2 2.5"
        stroke="#1e293b"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
