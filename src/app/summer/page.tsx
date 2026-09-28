import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Summer' };

/** Stub for the CAM-35 red checkpoint. */
export default async function SummerPage(_props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return null;
}
