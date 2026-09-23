import type { CalendarDate } from './calendarDate';
import type { EstimateRule } from './types';

/** An estimated first instructional day for the school year after one we hold. */
export interface FirstDayEstimate {
  readonly firstDay: CalendarDate;
  readonly rule: EstimateRule;
}

export function estimateNextFirstDay(_firstDay: CalendarDate): FirstDayEstimate | undefined {
  throw new Error('Not implemented');
}
