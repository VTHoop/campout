import { describe, expect, it } from 'vitest';
import { coveragePeriodOf, coveragePeriods, longestPeriod } from './closures';
import type { Closure, CoveragePeriod, SchoolYearCalendar } from './types';
import { CalendarType, ClosureTag, SchoolDistrict } from './types';

/**
 * Fixture calendars. Invented, not scraped — real district calendars are
 * reference data that belongs in the database. Shaped like the ones Chesterfield
 * publishes: a first and last instructional day, and dated closures in between.
 * Summer is never a closure here, because no district publishes one (ADR-0013).
 */

const holiday = (date: string): Closure => ({
  startDate: date,
  endDate: date,
  tags: [ClosureTag.Holiday],
  sourceLabel: 'Holiday, schools and offices closed',
});

const laborDay2026 = holiday('2026-09-07');

const thanksgiving: Closure = {
  startDate: '2026-11-25',
  endDate: '2026-11-27',
  tags: [ClosureTag.Break],
  sourceLabel: 'Thanksgiving break',
};

const winterBreak: Closure = {
  startDate: '2026-12-21',
  endDate: '2027-01-01',
  tags: [ClosureTag.Break],
  sourceLabel: 'Winter break',
  commonName: 'Winter break',
};

const springBreak: Closure = {
  startDate: '2027-03-29',
  endDate: '2027-04-02',
  tags: [ClosureTag.Break],
  sourceLabel: 'Spring break',
};

/** School ends Wednesday June 9 2027. Closures are deliberately out of date order. */
const year2026: SchoolYearCalendar = {
  district: SchoolDistrict.Chesterfield,
  type: CalendarType.Traditional,
  label: '2026-27',
  firstInstructionalDay: '2026-08-24',
  lastInstructionalDay: '2027-06-09',
  coversFrom: '2026-07-01',
  coversTo: '2027-06-30',
  closures: [winterBreak, laborDay2026, springBreak, thanksgiving],
};

/** School returns Wednesday Aug 25 2027, so summer runs Thu Jun 10 – Tue Aug 24. */
const year2027: SchoolYearCalendar = {
  district: SchoolDistrict.Chesterfield,
  type: CalendarType.Traditional,
  label: '2027-28',
  firstInstructionalDay: '2027-08-25',
  lastInstructionalDay: '2028-06-08',
  coversFrom: '2027-07-01',
  coversTo: '2028-06-30',
  closures: [holiday('2027-09-06')],
};

const bothYears = [year2026, year2027];

const startDates = (periods: ReturnType<typeof coveragePeriods>) =>
  periods.map((period) => period.closure.startDate);

/** The one period a single-day range touches. Fails the test if there is not exactly one. */
function periodOn(calendars: readonly SchoolYearCalendar[], day: string): CoveragePeriod {
  const [period, ...others] = coveragePeriods(calendars, day, day);
  if (!period || others.length > 0) throw new Error(`Expected exactly one period on ${day}`);
  return period;
}

describe('coveragePeriods', () => {
  it('returns every closure and the summer between the years, in date order', () => {
    const periods = coveragePeriods(bothYears, '2026-08-24', '2027-09-30');

    expect(startDates(periods)).toEqual([
      '2026-09-07',
      '2026-11-25',
      '2026-12-21',
      '2027-03-29',
      '2027-06-10',
      '2027-09-06',
    ]);
  });

  it('sorts the calendars themselves, so the caller need not', () => {
    const periods = coveragePeriods([year2027, year2026], '2026-08-24', '2027-09-30');

    expect(startDates(periods)).toEqual(
      startDates(coveragePeriods(bothYears, '2026-08-24', '2027-09-30')),
    );
  });

  it('counts the weekdays and weeks of a stored closure', () => {
    const winter = coveragePeriods(bothYears, '2026-12-24', '2026-12-24')[0];

    expect(winter?.closure).toEqual(winterBreak);
    expect(winter?.weekdays).toBe(10);
    expect(winter?.weeks.map((week) => week.monday)).toEqual(['2026-12-21', '2026-12-28']);
  });

  // Summer is derived from the gap between two calendars. It is a break, but the
  // district never said so, and the source label must not pretend it did.
  it('derives the summer between two adjacent years as a break', () => {
    const summer = periodOn(bothYears, '2027-07-15');

    expect(summer.closure.startDate).toBe('2027-06-10');
    expect(summer.closure.endDate).toBe('2027-08-24');
    expect(summer.closure.tags).toEqual([ClosureTag.Break]);
    expect(summer.closure.sourceLabel).toMatch(/derived/);
    expect(summer.weekdays).toBe(54);
    expect(summer.weeks).toHaveLength(12);
    expect(summer.weeks.at(0)?.isPartial).toBe(true);
    expect(summer.weeks.at(-1)?.isPartial).toBe(true);
  });

  it('returns the whole closure when the range covers only part of it', () => {
    const periods = coveragePeriods(bothYears, '2026-12-24', '2026-12-24');

    expect(periods).toHaveLength(1);
    expect(periods[0]?.closure.startDate).toBe('2026-12-21');
    expect(periods[0]?.closure.endDate).toBe('2027-01-01');
  });

  it('includes a period the range touches only on its last day', () => {
    const periods = coveragePeriods(bothYears, '2026-11-27', '2026-11-30');

    expect(startDates(periods)).toEqual(['2026-11-25']);
  });

  it('returns an empty list for a range we know about that holds no closures', () => {
    expect(coveragePeriods(bothYears, '2027-01-04', '2027-02-26')).toEqual([]);
  });

  it('leaves out a closure that falls entirely on a weekend', () => {
    const weekendOnly: SchoolYearCalendar = {
      ...year2026,
      closures: [{ ...holiday('2027-02-06'), endDate: '2027-02-07' }],
    };

    expect(coveragePeriods([weekendOnly], '2027-02-01', '2027-02-28')).toEqual([]);
  });

  it('treats a year-round calendar exactly like a traditional one', () => {
    const yearRound = bothYears.map((year) => ({ ...year, type: CalendarType.YearRound }));

    expect(coveragePeriods(yearRound, '2026-08-24', '2027-09-30')).toEqual(
      coveragePeriods(bothYears, '2026-08-24', '2027-09-30'),
    );
  });

  // Summer needs two years. With only the first, its end date is unknown, and
  // we never invent one (ADR-0013).
  it('leaves out the summer when the following year is not published', () => {
    const periods = coveragePeriods([year2026], '2026-08-24', '2027-06-09');

    expect(startDates(periods)).toEqual(['2026-09-07', '2026-11-25', '2026-12-21', '2027-03-29']);
  });

  it('leaves out the gap when the two years do not abut', () => {
    const skipped: SchoolYearCalendar = {
      ...year2027,
      label: '2028-29',
      firstInstructionalDay: '2028-08-24',
      lastInstructionalDay: '2029-06-08',
      coversFrom: '2028-07-01',
      coversTo: '2029-06-30',
      closures: [],
    };

    const periods = coveragePeriods([year2026, skipped], '2026-08-24', '2028-08-24');

    expect(startDates(periods)).toEqual(['2026-09-07', '2026-11-25', '2026-12-21', '2027-03-29']);
  });

  it('leaves out a gap that holds no weekdays', () => {
    const endsFriday: SchoolYearCalendar = { ...year2026, lastInstructionalDay: '2027-06-11' };
    const startsMonday: SchoolYearCalendar = {
      ...year2027,
      firstInstructionalDay: '2027-06-14',
      coversFrom: '2027-06-01',
    };

    const periods = coveragePeriods([endsFriday, startsMonday], '2027-06-01', '2027-06-30');

    expect(periods).toEqual([]);
  });

  it('throws when the range ends before it starts', () => {
    expect(() => coveragePeriods(bothYears, '2027-01-02', '2027-01-01')).toThrow(RangeError);
  });

  it('throws on a malformed date', () => {
    expect(() => coveragePeriods(bothYears, 'January', '2027-01-01')).toThrow(RangeError);
    expect(() => coveragePeriods(bothYears, '2027-01-01', 'February')).toThrow(RangeError);
  });

  // An empty answer for a range we hold no calendar for reads as "nothing to
  // plan" — the failure this product exists to prevent (AGENTS.md §1).
  it.each([
    ['starts before every calendar', '2026-06-30', '2026-09-01'],
    ['ends after every calendar', '2028-01-04', '2028-07-01'],
  ])('throws when the range %s', (_label, from, to) => {
    expect(() => coveragePeriods(bothYears, from, to)).toThrow(RangeError);
  });

  it('throws when the range ends in a summer whose following year is not published', () => {
    expect(() => coveragePeriods([year2026], '2026-08-24', '2027-06-20')).toThrow(RangeError);
  });

  it('throws when the range starts in a summer whose preceding year is not published', () => {
    expect(() => coveragePeriods([year2027], '2027-07-15', '2027-09-30')).toThrow(RangeError);
  });
});

describe('longestPeriod', () => {
  it('returns the summer between the labelled year and the next', () => {
    const summer = longestPeriod(bothYears, '2026-27');

    expect(summer?.closure.startDate).toBe('2027-06-10');
    expect(summer?.closure.endDate).toBe('2027-08-24');
    expect(summer?.weekdays).toBe(54);
    expect(summer?.weeks).toHaveLength(12);
  });

  it('numbers the summer weeks from zero', () => {
    const summer = longestPeriod(bothYears, '2026-27');

    expect(summer?.weeks.map((week) => week.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('finds the year whatever order the calendars arrive in', () => {
    expect(longestPeriod([year2027, year2026], '2026-27')?.closure.startDate).toBe('2027-06-10');
  });

  it('returns undefined when the following year is not in the list', () => {
    expect(longestPeriod([year2026], '2026-27')).toBeUndefined();
  });

  it('returns undefined for the last year we hold', () => {
    expect(longestPeriod(bothYears, '2027-28')).toBeUndefined();
  });

  it('returns undefined when the following year does not abut', () => {
    const skipped: SchoolYearCalendar = {
      ...year2027,
      label: '2028-29',
      firstInstructionalDay: '2028-08-24',
      lastInstructionalDay: '2029-06-08',
      coversFrom: '2028-07-01',
      coversTo: '2029-06-30',
      closures: [],
    };

    expect(longestPeriod([year2026, skipped], '2026-27')).toBeUndefined();
  });

  it('returns undefined when school runs straight through with no weekday between', () => {
    const endsFriday: SchoolYearCalendar = { ...year2026, lastInstructionalDay: '2027-06-11' };
    const startsMonday: SchoolYearCalendar = {
      ...year2027,
      firstInstructionalDay: '2027-06-14',
      coversFrom: '2027-06-01',
    };

    expect(longestPeriod([endsFriday, startsMonday], '2026-27')).toBeUndefined();
  });

  it('returns undefined when the next year starts the day after this one ends', () => {
    const startsNextDay: SchoolYearCalendar = {
      ...year2027,
      firstInstructionalDay: '2027-06-10',
      coversFrom: '2027-06-01',
    };

    expect(longestPeriod([year2026, startsNextDay], '2026-27')).toBeUndefined();
    expect(coveragePeriodOf([year2026, startsNextDay], '2027-06-10')).toBeUndefined();
  });

  it('throws when no calendar carries the label', () => {
    expect(() => longestPeriod(bothYears, '2031-32')).toThrow(RangeError);
  });

  it('throws when given no calendars at all', () => {
    expect(() => longestPeriod([], '2026-27')).toThrow(RangeError);
  });
});

describe('coveragePeriodOf', () => {
  it('finds the summer for a date in the middle of it', () => {
    expect(coveragePeriodOf(bothYears, '2027-07-15')?.closure.startDate).toBe('2027-06-10');
  });

  it('finds the summer for a weekend inside it', () => {
    expect(coveragePeriodOf(bothYears, '2027-06-12')?.closure.startDate).toBe('2027-06-10');
  });

  it('finds the first and last day of the summer', () => {
    expect(coveragePeriodOf(bothYears, '2027-06-10')?.closure.startDate).toBe('2027-06-10');
    expect(coveragePeriodOf(bothYears, '2027-08-24')?.closure.startDate).toBe('2027-06-10');
  });

  it('finds a stored closure, carrying the district’s own words', () => {
    const period = coveragePeriodOf(bothYears, '2026-12-25');

    expect(period?.closure.sourceLabel).toBe('Winter break');
    expect(period?.closure.commonName).toBe('Winter break');
    expect(period?.weekdays).toBe(10);
  });

  it('finds a closure from a weekend inside it', () => {
    expect(coveragePeriodOf(bothYears, '2026-12-26')?.closure.startDate).toBe('2026-12-21');
  });

  it('returns undefined on a day school is in session', () => {
    expect(coveragePeriodOf(bothYears, '2026-10-14')).toBeUndefined();
  });

  it('returns undefined on the first and last instructional days', () => {
    expect(coveragePeriodOf(bothYears, '2026-08-24')).toBeUndefined();
    expect(coveragePeriodOf(bothYears, '2027-06-09')).toBeUndefined();
  });

  it('returns undefined on an ordinary weekend during the school year', () => {
    expect(coveragePeriodOf(bothYears, '2026-10-17')).toBeUndefined();
  });

  it('returns undefined for a closure that falls entirely on a weekend', () => {
    const weekendOnly: SchoolYearCalendar = {
      ...year2026,
      closures: [{ ...holiday('2027-02-06'), endDate: '2027-02-07' }],
    };

    expect(coveragePeriodOf([weekendOnly], '2027-02-06')).toBeUndefined();
  });

  it('returns undefined for a weekend between two years that run back to back', () => {
    const endsFriday: SchoolYearCalendar = { ...year2026, lastInstructionalDay: '2027-06-11' };
    const startsMonday: SchoolYearCalendar = {
      ...year2027,
      firstInstructionalDay: '2027-06-14',
      coversFrom: '2027-06-01',
    };

    expect(coveragePeriodOf([endsFriday, startsMonday], '2027-06-12')).toBeUndefined();
  });

  // A date we hold no calendar for is not "school is in session" (AGENTS.md §1).
  it.each([
    ['before every calendar', '2026-06-30'],
    ['after every calendar', '2028-07-01'],
  ])('throws for a date %s', (_label, date) => {
    expect(() => coveragePeriodOf(bothYears, date)).toThrow(RangeError);
  });

  // Inside the 2026-27 window, but the summer's end depends on a calendar we do
  // not hold. Answering "in session" here would be wrong, and so would a guess.
  it('throws for a summer date when the following year is not published', () => {
    expect(() => coveragePeriodOf([year2026], '2027-06-20')).toThrow(RangeError);
  });

  it('throws for a summer date when the preceding year is not published', () => {
    expect(() => coveragePeriodOf([year2027], '2027-07-15')).toThrow(RangeError);
  });

  it('throws when given no calendars at all', () => {
    expect(() => coveragePeriodOf([], '2026-10-14')).toThrow(RangeError);
  });

  it('throws on a malformed date', () => {
    expect(() => coveragePeriodOf(bothYears, 'whenever')).toThrow(RangeError);
  });
});

// A record that contradicts itself is a bug, not an input. Rendering it would put
// a wrong day on a parent's grid, so the planner refuses (AGENTS.md §1).
describe('refusing inconsistent calendars', () => {
  const askAbout = (calendars: readonly SchoolYearCalendar[]) =>
    coveragePeriodOf(calendars, '2026-10-14');

  it.each([
    [
      'a closure that ends before it starts',
      [{ ...year2026, closures: [{ ...holiday('2026-09-08'), endDate: '2026-09-07' }] }],
    ],
    ['a closure with a malformed date', [{ ...year2026, closures: [holiday('Labor Day')] }]],
    [
      'a closure before the first instructional day',
      [{ ...year2026, closures: [holiday('2026-08-20')] }],
    ],
    [
      'a closure after the last instructional day',
      [{ ...year2026, closures: [holiday('2027-06-15')] }],
    ],
    [
      'two closures that share a day',
      [
        {
          ...year2026,
          closures: [{ ...thanksgiving, endDate: '2026-11-26' }, { ...holiday('2026-11-26') }],
        },
      ],
    ],
    [
      'a last instructional day that is not after the first',
      [{ ...year2026, lastInstructionalDay: '2026-08-24' }],
    ],
    [
      'a coverage window that starts after school does',
      [{ ...year2026, coversFrom: '2026-09-01' }],
    ],
    ['a coverage window that ends before school does', [{ ...year2026, coversTo: '2027-05-31' }]],
    ['calendars from two districts', [year2026, { ...year2027, district: SchoolDistrict.Henrico }]],
    [
      'a district calendar mixed with a single school’s',
      [year2026, { ...year2027, school: 'Bellwood Elementary' }],
    ],
    ['two calendars with the same label', [year2026, { ...year2027, label: '2026-27' }]],
    [
      'two school years that overlap',
      [year2026, { ...year2027, firstInstructionalDay: '2027-05-01', coversFrom: '2027-04-01' }],
    ],
  ])('throws for %s', (_label, calendars) => {
    expect(() => askAbout(calendars)).toThrow(RangeError);
  });
});
