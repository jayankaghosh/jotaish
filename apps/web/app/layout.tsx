import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cormorant' });

export const metadata: Metadata = {
  title: 'Jotaish - Your personal astrologer',
  description: 'Vedic astrology, horoscopes, tarot, numerology, palm reading and dream interpretation, with a personal astrologer to guide you.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
