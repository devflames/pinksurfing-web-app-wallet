import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
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
    icon: [{ url: '/logo.jpeg', type: 'image/jpeg' }],
    apple: [{ url: '/logo.jpeg', type: 'image/jpeg' }],
    shortcut: ['/logo.jpeg'],
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
