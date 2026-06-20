type Props = { size?: number; className?: string };

/** Search to add contacts — navy person + magnifier */
export function ContactSearchIcon({ size = 28, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="13" cy="11" r="5" fill="#2B3F6B" />
      <path
        d="M8 22c0-3.9 2.7-7 6-7s6 3.1 6 7v1H8v-1z"
        fill="#2B3F6B"
      />
      <circle cx="21.5" cy="21.5" r="4.5" stroke="#2B3F6B" strokeWidth="2.2" fill="none" />
      <path d="M25 25l4 4" stroke="#2B3F6B" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
