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

/** How a school year is shaped (ADR-0013). No v1 calendar is year-round, but the model is ready for one. */
export enum CalendarType {
  Traditional = 'traditional',
  YearRound = 'year_round',
}

/** Facts a district attaches to a closed day. A closure carries a set, never one. */
export enum ClosureTag {
  Holiday = 'holiday',
  TeacherWorkday = 'teacher_workday',
  ConferenceDay = 'conference_day',
  Break = 'break',
}

/** A run of days school is shut. Inclusive; a single day repeats `startDate`. */
export interface Closure {
  readonly startDate: CalendarDate;
  readonly endDate: CalendarDate;
  readonly tags: readonly ClosureTag[];
  /** The district's exact words. Often useless alone: CCPS says "Holiday" nine times. */
  readonly sourceLabel: string;
  /** What a parent would call it. Ours, not the district's, and separately sourced. */
  readonly commonName?: string;
}

/** One school year's published calendar. What we store; everything else is derived. */
export interface SchoolYearCalendar {
  readonly district: SchoolDistrict;
  readonly type: CalendarType;
  /** Absent for the district-wide calendar; set only for a school that runs its own. */
  readonly school?: string;
  /**
   * The district's name for the year, written YYYY-YY: "2026-27". The planner pairs
   * neighbouring years by it ("2026-27" then "2027-28") and refuses any other form.
   */
  readonly label: string;
  readonly firstInstructionalDay: CalendarDate;
  readonly lastInstructionalDay: CalendarDate;
  /**
   * The window this record speaks for. It must contain the school year itself. It
   * need not reach across summer: that is derived from the neighbouring year.
   */
  readonly coversFrom: CalendarDate;
  readonly coversTo: CalendarDate;
  readonly closures: readonly Closure[];
}

/** One column of the planner grid: a Monday-anchored week a parent has to cover. */
export interface CoverageWeek {
  /** Zero-based position within its period, stable for a given closure. */
  readonly index: number;
  readonly monday: CalendarDate;
  readonly friday: CalendarDate;
  /**
   * Whether every weekday in this week needs cover. A period rarely starts on a
   * Monday and ends on a Friday, and a partial week is not a coverage gap in the
   * same sense a full one is.
   */
  readonly isPartial: boolean;
  /** First weekday in this week that actually needs cover. */
  readonly firstDayNeedingCover: CalendarDate;
  /** Last weekday in this week that actually needs cover. */
  readonly lastDayNeedingCover: CalendarDate;
}

/** Whether a period's dates all come from published calendars, or one end is our estimate. */
export enum PeriodBasis {
  Published = 'published',
  Estimated = 'estimated',
}

/** Which rule estimated an unpublished first day back (ADR-0014). */
export enum EstimateRule {
  /** This year's first day is within a week of Labor Day: keep the same offset from it. */
  LaborDayAnchor = 'labor_day_anchor',
  /** Otherwise: the same weekday, the same number of weeks before the end of the same month. */
  WeekdayFromMonthEnd = 'weekday_from_month_end',
}

interface CoveragePeriodShape {
  readonly closure: Closure;
  /** How many weekdays in the closure need cover. Weekends never count. */
  readonly weekdays: number;
  readonly weeks: readonly CoverageWeek[];
}

/** Every date comes from a calendar a district published. */
export interface PublishedPeriod extends CoveragePeriodShape {
  readonly basis: PeriodBasis.Published;
}

/**
 * A summer whose following year is not published: it ends the day before a
 * first day back we estimated. A union rather than an optional rule, so an
 * estimated period without its rule cannot be built.
 */
export interface EstimatedPeriod extends CoveragePeriodShape {
  readonly basis: PeriodBasis.Estimated;
  readonly estimatedBy: EstimateRule;
}

/**
 * A run of closed weekdays a parent has to cover: a stored closure, or the
 * derived gap between two school years.
 */
export type CoveragePeriod = PublishedPeriod | EstimatedPeriod;
