import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Campout',
  description:
    'Plan the days school is out, from twelve weeks of summer to a single teacher workday.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
