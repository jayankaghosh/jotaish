import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter, Noto_Sans_Bengali, Noto_Sans_Devanagari, Noto_Sans_Kannada, Noto_Sans_Malayalam } from 'next/font/google';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cormorant' });
// Indian scripts load only when a page actually shows them.
const devanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-devanagari', preload: false });
const malayalam = Noto_Sans_Malayalam({ subsets: ['malayalam'], variable: '--font-malayalam', preload: false });
const kannada = Noto_Sans_Kannada({ subsets: ['kannada'], variable: '--font-kannada', preload: false });
const bengali = Noto_Sans_Bengali({ subsets: ['bengali'], variable: '--font-bengali', preload: false });

export const metadata: Metadata = {
  title: 'Jotaish - Your personal astrologer',
  description: 'Vedic astrology, horoscopes, tarot, numerology, palm reading and dream interpretation, with a personal astrologer to guide you.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fonts = [inter, cormorant, devanagari, malayalam, kannada, bengali].map((f) => f.variable).join(' ');
  return (
    <html lang="en" className={fonts}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <I18nProvider>{children}</I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
