'use client';

import QRCode from 'react-qr-code';

type Props = {
  value: string;
  size?: number;
  fgColor?: string;
};

/** White-backed QR — pink default matches client business cards */
export function QrDisplay({ value, size = 96, fgColor = '#ff1493' }: Props) {
  return (
    <div
      className="inline-flex rounded-lg bg-white p-2 shadow-sm"
      style={{ lineHeight: 0 }}
    >
      <QRCode
        value={value || 'pinksurfing.com'}
        size={size}
        level="M"
        bgColor="#ffffff"
        fgColor={fgColor}
      />
    </div>
  );
}
