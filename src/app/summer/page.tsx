import type { Metadata } from 'next';
import { richmondDate } from '@/lib/today';
import { SummerView } from './summer-view';

export const metadata: Metadata = { title: 'Summer' };

/**
 * The Summer page. The request boundary: the one place the wall clock is read
 * and the URL's `?summer=` is taken. Everything below it is given both.
 */
export default async function SummerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { summer } = await searchParams;
  return <SummerView today={richmondDate(new Date())} requested={summer} />;
}
