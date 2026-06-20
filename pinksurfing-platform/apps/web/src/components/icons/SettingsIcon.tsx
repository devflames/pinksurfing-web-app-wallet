type Props = { size?: number; className?: string };

export function SettingsIcon({ size = 20, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 13a7.8 7.8 0 0 0 .1-2l2-1.2-2-3.5-2.3.9a8 8 0 0 0-1.7-1L15 3.5h-4L8.5 6.2a8 8 0 0 0-1.7 1L4.5 6.3l-2 3.5 2 1.2a7.8 7.8 0 0 0 0 2l-2 1.2 2 3.5 2.3-.9a8 8 0 0 0 1.7 1L11 20.5h4l2.5-2.7a8 8 0 0 0 1.7-1l2.3.9 2-3.5-2-1.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
