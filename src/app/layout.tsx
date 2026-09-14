import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Campout',
  description: 'Plan your kids’ summer, week by week.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
