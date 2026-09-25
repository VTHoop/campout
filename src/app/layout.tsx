import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { SiteNav } from '../components/site-nav';
import './globals.css';

// Self-hosted at build time, so no request reaches Google from the browser. The
// fallback metrics next/font generates keep the swap free of layout shift.
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage-grotesque',
});

const sans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
});

export const metadata: Metadata = {
  title: { default: 'Campout', template: '%s · Campout' },
  description:
    'Plan the days school is out, from twelve weeks of summer to a single teacher workday.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
