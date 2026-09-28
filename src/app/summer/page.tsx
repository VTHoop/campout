import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Summer' };

type SearchParams = Record<string, string | string[] | undefined>;

/** The query parameters the camp finder read when it lived on /summer (CAM-30–32). */
const FINDER_PARAMS = ['summer', 'week'] as const;

function queryOf(searchParams: SearchParams): URLSearchParams {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(searchParams)) {
    for (const each of [value ?? []].flat()) query.append(name, each);
  }
  return query;
}

/**
 * The Summer page: the family's summer plan (CAM-11), a placeholder until then.
 *
 * The camp finder lived here until CAM-35 moved it to /camps, so a link made
 * for it (`/summer?week=3`) is sent on with its query intact. The redirect is
 * temporary (307), not permanent: browsers cache a permanent one, and CAM-11
 * may give `?week=` a meaning of its own here.
 */
export default async function SummerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = queryOf(await searchParams);
  if (FINDER_PARAMS.some((name) => query.has(name))) redirect(`/camps?${query.toString()}`);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-display text-ink">Summer</h1>
      <p className="mt-3 text-body text-ink-muted">You are on the Summer page.</p>
    </main>
  );
}
