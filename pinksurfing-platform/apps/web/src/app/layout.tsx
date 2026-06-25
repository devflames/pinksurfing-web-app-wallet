import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { withBasePath } from '@/lib/base-path';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PinkSurfing',
  description: 'Unified messaging, contracts, and wallet platform',
  icons: {
    icon: [
      { url: withBasePath('/favicon.ico') },
      { url: withBasePath('/logo.jpeg'), type: 'image/jpeg' },
    ],
    apple: [{ url: withBasePath('/logo.jpeg'), type: 'image/jpeg' }],
    shortcut: [withBasePath('/favicon.ico')],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
