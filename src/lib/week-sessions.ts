import type { CalendarDate } from '@campout/planner';
import type { SessionCardView } from './catalog/session-cards';

export function cardsInWeek(
  _cards: readonly SessionCardView[],
  _monday: CalendarDate,
): readonly SessionCardView[] {
  return [];
}

export function weekIndexFrom(_param: string | null, _weekCount: number): number {
  return -1;
}
