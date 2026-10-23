import { addDays, type CalendarDate, compareDates, Weekday, weekdayOf } from '@campout/planner';
import type { AgeRange, GradeRange, LocationAddress, WallClockTime } from './catalog/types';
import { dayOfMonth, longMonth, longWeekday, shortMonth, shortWeekday } from './dates';

/**
 * The session card's facts, as a parent reads them (CAM-32; DESIGN.md → *The
 * session card*). A fact the source did not state comes back `undefined`, never
 * as a default: the card says "Hours not stated" rather than implying all day.
 * Dates go through `./dates`, so the day shown is the day stored.
 */

export interface WeekTab {
  /** `Jun`, or `Jun–Jul` when the session crosses a month. */
  readonly month: string;
  /** `15–19`, or `17` for a one-day session. */
  readonly range: string;
  /** `Mon–Fri`, `Mon–Wed`, or `Wed` for one day. */
  readonly days: string;
  /** Monday to Friday. Anything else is a partial span, set in brick. */
  readonly fullWeek: boolean;
  /** The tab as one phrase: `June 15 to 19, Monday to Friday`. */
  readonly spoken: string;
}

const SCHOOL_WEEK = [
  Weekday.Monday,
  Weekday.Tuesday,
  Weekday.Wednesday,
  Weekday.Thursday,
  Weekday.Friday,
];

/**
 * A session that ends before this leaves the afternoon open. A stand-in for the
 * household's workday, which the planner will supply (CAM-51).
 */
const EARLY_END: WallClockTime = '15:00';

const WHOLE_DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const DOLLARS_AND_CENTS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** `from–to` when the two differ, else just the one. */
function span(from: string, to: string, joiner: string): string {
  return from === to ? from : `${from}${joiner}${to}`;
}

/** `14:00` → `2:00pm`. */
function clockTime(time: WallClockTime): string {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const suffix = hours < 12 ? 'am' : 'pm';
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(twelveHour)}:${String(minutes).padStart(2, '0')}${suffix}`;
}

export function formatHours(start?: WallClockTime, end?: WallClockTime): string | undefined {
  if (start === undefined || end === undefined) return undefined;
  return `${clockTime(start)} – ${clockTime(end)}`;
}

export function formatPrice(cents?: number): string | undefined {
  if (cents === undefined) return undefined;
  const format = cents % 100 === 0 ? WHOLE_DOLLARS : DOLLARS_AND_CENTS;
  return format.format(cents / 100);
}

/** `5–15`, `5 and up`, `up to 15`; undefined when neither end is stated. */
function rangeValue(
  { min, max }: { readonly min?: number; readonly max?: number },
  label: (value: number) => string,
): string | undefined {
  if (min !== undefined && max !== undefined) return `${label(min)}–${label(max)}`;
  if (min !== undefined) return `${label(min)} and up`;
  if (max !== undefined) return `up to ${label(max)}`;
  return undefined;
}

function withNoun(noun: string, value: string | undefined): string | undefined {
  return value && `${noun} ${value}`;
}

const gradeLabel = (grade: number): string => (grade === 0 ? 'K' : String(grade));

export function agesValue(range?: AgeRange): string | undefined {
  return range && rangeValue(range, String);
}

/** Grade 0 is kindergarten. */
export function gradesValue(range?: GradeRange): string | undefined {
  return range && rangeValue(range, gradeLabel);
}

export function formatAges(range?: AgeRange): string | undefined {
  return withNoun('Ages', agesValue(range));
}

export function formatGrades(range?: GradeRange): string | undefined {
  return withNoun('Grades', gradesValue(range));
}

export function weekTab(start: CalendarDate, end: CalendarDate): WeekTab {
  return {
    month: span(shortMonth(start), shortMonth(end), '–'),
    range: span(dayOfMonth(start), dayOfMonth(end), '–'),
    days: span(shortWeekday(start), shortWeekday(end), '–'),
    fullWeek: weekdayOf(start) === Weekday.Monday && weekdayOf(end) === Weekday.Friday,
    spoken: `${spokenDates(start, end)}, ${span(longWeekday(start), longWeekday(end), ' to ')}`,
  };
}

/** `June 15 to 19`, `June 29 to July 3`, or `June 17`. */
function spokenDates(start: CalendarDate, end: CalendarDate): string {
  const from = `${longMonth(start)} ${dayOfMonth(start)}`;
  if (start === end) return from;
  const sameMonth = longMonth(start) === longMonth(end);
  return `${from} to ${sameMonth ? dayOfMonth(end) : `${longMonth(end)} ${dayOfMonth(end)}`}`;
}

/** Monday to Friday, in order: whether the session runs that day. */
export function weekBar(start: CalendarDate, end: CalendarDate): readonly boolean[] {
  const running = new Set<Weekday>();
  for (let day = start; compareDates(day, end) <= 0; day = addDays(day, 1)) {
    running.add(weekdayOf(day));
  }
  return SCHOOL_WEEK.map((weekday) => running.has(weekday));
}

/** Whether a session ends before the afternoon; one that states no end time does not. */
export function endsEarly(endTime?: WallClockTime): boolean {
  return endTime !== undefined && endTime < EARLY_END;
}

const TRAILING_PARENTHETICAL = /\s*\([^)]*\)\s*$/;

function sameName(provider: string, location: string): boolean {
  const bare = (name: string) => name.replace(TRAILING_PARENTHETICAL, '').trim().toLowerCase();
  return bare(provider) === bare(location);
}

/** `Provider, City`, or `Provider at Location, City` when the location has its own name. */
export function locationLine(provider: string, location: string, city: string): string {
  return sameName(provider, location)
    ? `${provider}, ${city}`
    : `${provider} at ${location}, ${city}`;
}

/** The day a session was verified, as the card says it: `May 1, 2026`. */
export function formatVerifiedOn(date: CalendarDate): string {
  return `${shortMonth(date)} ${dayOfMonth(date)}, ${date.slice(0, 4)}`;
}

/** An address on one line, for a reviewer to check against its source. */
export function formatAddress(address: LocationAddress): string {
  return `${address.street}, ${address.city}, ${address.state} ${address.postalCode}`;
}
