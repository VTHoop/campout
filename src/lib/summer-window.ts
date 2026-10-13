import type { CalendarDate, SummerChoice, SummerChoices } from '@campout/planner';
import type { DateWindow } from './catalog/session-cards';

/** The summer the URL names, or the upcoming one when it names none on offer. */
export function chosenSummer(
  _choices: SummerChoices,
  _requested: string | string[] | undefined,
): SummerChoice {
  throw new Error('not implemented');
}

/** First Monday to last Friday of the summer the page will show: the sessions worth reading. */
export function summerWindow(
  _today: CalendarDate,
  _requested: string | string[] | undefined,
): DateWindow {
  throw new Error('not implemented');
}
