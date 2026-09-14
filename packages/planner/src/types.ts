import type { CalendarDate } from './calendarDate';

/**
 * The four Richmond-metro districts Campout covers.
 *
 * A string enum rather than a literal union, per AGENTS.md → Code conventions:
 * callers get a named symbol instead of a quoted string to typo. The persisted
 * domain lives in a Postgres CHECK constraint; where the two describe the same
 * set, the database owns it and this enum is guard-locked to the generated type.
 */
export enum SchoolDistrict {
  RichmondCity = 'richmond_city',
  Chesterfield = 'chesterfield',
  Henrico = 'henrico',
  Hanover = 'hanover',
}

/**
 * One district's school year boundaries. This is the reference data the entire
 * coverage model rests on — without it, "which weeks are uncovered?" has no
 * answer.
 */
export interface SchoolCalendar {
  readonly district: SchoolDistrict;
  /** The calendar year summer falls in, e.g. 2027. */
  readonly year: number;
  /** Last day students attend before summer. */
  readonly lastDayOfSchool: CalendarDate;
  /** First day students return. */
  readonly firstDayOfSchool: CalendarDate;
}

/**
 * One column of the planner grid: a Monday-anchored week of summer that a
 * parent has to cover.
 */
export interface SummerWeek {
  /** Zero-based position in the summer, stable for a given calendar. */
  readonly index: number;
  readonly monday: CalendarDate;
  readonly friday: CalendarDate;
  /**
   * Whether every weekday in this week needs cover. The first and last weeks of
   * summer are usually partial — school ends midweek, or starts midweek — and a
   * partial week is not a coverage gap in the same sense a full one is.
   */
  readonly isPartial: boolean;
  /** First weekday in this week that actually needs cover. */
  readonly firstDayNeedingCover: CalendarDate;
  /** Last weekday in this week that actually needs cover. */
  readonly lastDayNeedingCover: CalendarDate;
}
