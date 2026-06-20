'use client';

type Props = {
  children: React.ReactNode;
  /** Narrow (share) vs default vs wide (explore) */
  width?: 'narrow' | 'default' | 'wide';
  className?: string;
};

const WIDTH = {
  narrow: 'max-w-md',
  default: 'max-w-xl',
  wide: 'max-w-3xl',
} as const;

export function SectionPanel({ children, width = 'default', className = '' }: Props) {
  return (
    <div className={`ps-scroll flex min-h-0 flex-1 overflow-y-auto ${className}`}>
      <div className={`mx-auto w-full ${WIDTH[width]} px-4 py-5 sm:px-6 sm:py-6`}>{children}</div>
    </div>
  );
}
