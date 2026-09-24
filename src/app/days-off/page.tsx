import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Days off' };

/** Placeholder until the Days off page is built. */
export default function DaysOffPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-display text-ink">Days off</h1>
      <p className="mt-3 text-body text-ink-muted">You are on the Days off page.</p>
    </main>
  );
}
