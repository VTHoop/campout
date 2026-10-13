import {
  type CalendarDate,
  type SummerChoice,
  type SummerChoices,
  summerChoices,
} from '@campout/planner';
import { CHESTERFIELD_CALENDARS } from './calendars/chesterfield';
import type { DateWindow } from './catalog/session-cards';

/** The summer the URL names, or the upcoming one when it names none on offer. */
export function chosenSummer(
  { summers, upcoming }: SummerChoices,
  requested: string | string[] | undefined,
): SummerChoice {
  if (typeof requested !== 'string') return upcoming;
  return summers.find((summer) => String(summer.year) === requested) ?? upcoming;
}

/** First Monday to last Friday of the summer the page will show: the sessions worth reading. */
export function summerWindow(
  today: CalendarDate,
  requested: string | string[] | undefined,
): DateWindow {
  const { period } = chosenSummer(summerChoices(CHESTERFIELD_CALENDARS, today), requested);
  const first = period.weeks.at(0);
  const last = period.weeks.at(-1);
  if (first === undefined || last === undefined)
    throw new Error(`Summer ${String(requested)} has no weeks`);
  return { start: first.monday, end: last.friday };
}
