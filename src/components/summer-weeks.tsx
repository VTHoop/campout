'use client';

import type { CoverageWeek } from '@campout/planner';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import type { OnApprove } from '@/components/approve-controls';
import { SessionCard } from '@/components/session-card';
import { WeekPicker } from '@/components/week-picker';
import { type Approvals, applyApprovals, approveRecord, recordKey } from '@/lib/catalog/approve';
import type { SessionCardView } from '@/lib/catalog/session-cards';
import { shortMonthDay } from '@/lib/dates';
import { createClient } from '@/lib/supabase/browser';
import { cardsInWeek, weekIndexFrom } from '@/lib/week-sessions';

/**
 * The summer's week picker over the selected week's session cards (CAM-32).
 *
 * The selected week lives in the URL (`?week=3`), so a reload, back/forward and
 * a shared link all show it. Choosing a week pushes a history entry through the
 * native History API, which Next.js syncs into `useSearchParams` without a
 * server round trip: the summer's cards are already here.
 *
 * `children` is the band's text block, set beside the picker.
 */

const HEADING_ID = 'week-camps';

function headingFor(count: number, week: CoverageWeek): string {
  if (count === 0) return `No camps listed for week ${String(week.index + 1)}`;
  const camps = count === 1 ? '1 camp' : `${String(count)} camps`;
  return `${camps}, week of ${shortMonthDay(week.monday)}`;
}

/**
 * A reviewer's approvals (CAM-46): `approve_record()` as the signed-in user,
 * then every card that carries the approved record shows it verified. Held
 * here, not in a card, because a camp's other sessions are other cards.
 */
function useApprovals(cards: readonly SessionCardView[], canApprove: boolean) {
  const client = useMemo(() => (canApprove ? createClient() : undefined), [canApprove]);
  const [approvals, setApprovals] = useState<Approvals>(new Map());
  const onApprove = useCallback<OnApprove>(
    async (kind, id, confirmLongSpan) => {
      if (client === undefined) throw new Error('Approving needs a signed-in reviewer');
      const result = await approveRecord(client, kind, id, confirmLongSpan);
      if (result.ok) setApprovals((all) => new Map(all).set(recordKey(kind, id), result.on));
      return result;
    },
    [client],
  );
  return {
    cards: useMemo(() => applyApprovals(cards, approvals), [cards, approvals]),
    onApprove: canApprove ? onApprove : undefined,
  };
}

export function SummerWeeks({
  weeks,
  cards,
  canApprove = false,
  children,
}: {
  weeks: readonly CoverageWeek[];
  cards: readonly SessionCardView[];
  /** True for a reviewer: the cards show approve controls on their draft records. */
  canApprove?: boolean;
  children?: ReactNode;
}) {
  const searchParams = useSearchParams();
  const { cards: shown, onApprove } = useApprovals(cards, canApprove);
  const selected = weekIndexFrom(searchParams.get('week'), weeks.length);
  const week = weeks.at(selected);
  if (week === undefined) throw new RangeError('A summer has at least one week');
  const weekCards = cardsInWeek(shown, week.monday);

  function choose(index: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('week', String(index + 1));
    window.history.pushState(null, '', `?${params.toString()}`);
  }

  return (
    <>
      <section
        aria-labelledby="your-summer"
        className="flex flex-col gap-3 border-rule border-b bg-surface px-4 py-3 lg:flex-row lg:items-center lg:gap-6 lg:px-6"
      >
        {children}
        <WeekPicker weeks={weeks} selected={selected} onSelect={choose} />
      </section>
      <section
        aria-labelledby={HEADING_ID}
        className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6"
      >
        {/* Only the heading is live, so a change of week is announced once. */}
        <h2
          id={HEADING_ID}
          aria-live="polite"
          className="font-display text-heading text-ink tabular-nums"
        >
          {headingFor(weekCards.length, week)}
        </h2>
        {weekCards.length === 0 ? null : (
          <ul aria-labelledby={HEADING_ID} className="flex flex-col gap-4">
            {weekCards.map((card) => (
              <SessionCard
                key={card.id}
                card={card}
                weekNumber={selected + 1}
                onApprove={onApprove}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
