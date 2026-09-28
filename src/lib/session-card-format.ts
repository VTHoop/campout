import type { CalendarDate } from '@campout/planner';
import type { AgeRange, GradeRange, WallClockTime } from './catalog/types';

export interface WeekTab {
  readonly month: string;
  readonly range: string;
  readonly days: string;
  readonly fullWeek: boolean;
  readonly spoken: string;
}

export function formatHours(_start?: WallClockTime, _end?: WallClockTime): string | undefined {
  return undefined;
}

export function formatPrice(_cents?: number): string | undefined {
  return undefined;
}

export function formatAges(_range?: AgeRange): string | undefined {
  return undefined;
}

export function formatGrades(_range?: GradeRange): string | undefined {
  return undefined;
}

export function weekTab(_start: CalendarDate, _end: CalendarDate): WeekTab {
  return { month: '', range: '', days: '', fullWeek: false, spoken: '' };
}

export function partialWeekCallout(
  _start: CalendarDate,
  _end: CalendarDate,
  _endTime?: WallClockTime,
): string | undefined {
  return undefined;
}
