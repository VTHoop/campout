import { type CalendarDate, compareDates, mondayOf } from '@campout/planner';
import type { SessionCardView } from './catalog/session-cards';

/**
 * Which cards show under the selected summer week, and which week the URL's
 * `?week=` selects (CAM-32).
 */

function byStartThenName(a: SessionCardView, b: SessionCardView): number {
  return compareDates(a.startDate, b.startDate) || a.campName.localeCompare(b.campName);
}

/** The cards whose session starts in the week of `monday`, by start date then camp name. */
export function cardsInWeek(
  cards: readonly SessionCardView[],
  monday: CalendarDate,
): readonly SessionCardView[] {
  return cards.filter((card) => mondayOf(card.startDate) === monday).sort(byStartThenName);
}

const WEEK_NUMBER = /^\d+$/;

/**
 * The zero-based week `?week=N` names. A missing, non-numeric or out-of-range
 * value selects week 1: a stale shared link still lands on the summer.
 */
export function weekIndexFrom(param: string | null, weekCount: number): number {
  if (param === null || !WEEK_NUMBER.test(param)) return 0;
  const number = Number(param);
  return number >= 1 && number <= weekCount ? number - 1 : 0;
}
