import type { Metadata } from 'next';
import { listSessionCards } from '@/lib/catalog/session-cards';
import { summerWindow } from '@/lib/summer-window';
import { createClient } from '@/lib/supabase/server';
import { richmondDate } from '@/lib/today';
import { CampsView } from './camps-view';

export const metadata: Metadata = { title: 'Find camps' };

/**
 * The Find camps page (CAM-35; built on /summer in CAM-30–32). The request boundary: the one place the wall clock is read,
 * the URL's `?summer=` is taken and the session cards are loaded. Everything
 * below it is given all three. (`?week=` is read on the client, which changes
 * it without a round trip.)
 */
export default async function CampsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const today = richmondDate(new Date());
  const [client, { summer }] = await Promise.all([createClient(), searchParams]);
  const cards = await listSessionCards(client, summerWindow(today, summer));
  return <CampsView today={today} requested={summer} cards={cards} canApprove={false} />;
}
