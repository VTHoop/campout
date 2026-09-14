import { describe, expect, it } from 'vitest';
import type { SchoolCalendar } from './types';
import { SchoolDistrict } from './types';
import { summerWeekIndexOf, summerWeeks } from './weeks';

/**
 * Fixture calendars. Invented, not scraped — real district calendars are
 * reference data that belongs in the database, and these exist to pin the
 * boundary arithmetic rather than to be accurate.
 */

/** School ends Friday, returns Monday: both boundary weeks are full. */
const cleanBoundaries: SchoolCalendar = {
  district: SchoolDistrict.Chesterfield,
  year: 2027,
  lastDayOfSchool: '2027-06-11',
  firstDayOfSchool: '2027-08-23',
};

/** School ends Wednesday, returns Wednesday: both boundary weeks are partial. */
const midweekBoundaries: SchoolCalendar = {
  district: SchoolDistrict.Henrico,
  year: 2027,
  lastDayOfSchool: '2027-06-09',
  firstDayOfSchool: '2027-08-25',
};

describe('summerWeeks — clean Friday-to-Monday boundaries', () => {
  const weeks = summerWeeks(cleanBoundaries);

  it('produces the ten weeks the product is built around', () => {
    expect(weeks).toHaveLength(10);
  });

  it('starts the Monday after the last day of school', () => {
    expect(weeks[0]?.monday).toBe('2027-06-14');
    expect(weeks[0]?.friday).toBe('2027-06-18');
  });

  it('ends the week containing the last weekday before school returns', () => {
    expect(weeks.at(-1)?.monday).toBe('2027-08-16');
    expect(weeks.at(-1)?.friday).toBe('2027-08-20');
  });

  it('marks no week partial when school ends Friday and returns Monday', () => {
    expect(weeks.every((week) => !week.isPartial)).toBe(true);
  });

  it('needs cover Monday through Friday in every week', () => {
    for (const week of weeks) {
      expect(week.firstDayNeedingCover).toBe(week.monday);
      expect(week.lastDayNeedingCover).toBe(week.friday);
    }
  });

  it('numbers weeks consecutively from zero', () => {
    expect(weeks.map((week) => week.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('spaces every Monday exactly seven days apart', () => {
    const mondays = weeks.map((week) => week.monday);
    expect(mondays).toEqual([
      '2027-06-14',
      '2027-06-21',
      '2027-06-28',
      '2027-07-05',
      '2027-07-12',
      '2027-07-19',
      '2027-07-26',
      '2027-08-02',
      '2027-08-09',
      '2027-08-16',
    ]);
  });
});

describe('summerWeeks — midweek boundaries', () => {
  const weeks = summerWeeks(midweekBoundaries);

  it('includes the stub week at each end', () => {
    expect(weeks).toHaveLength(12);
  });

  // School ends Wednesday June 9, so Thursday and Friday of that week still need
  // cover. Dropping the week would hide a real gap; treating it as full would
  // report a gap on Monday through Wednesday, when the child was in school.
  it('opens with a partial week covering only the days after school ends', () => {
    const first = weeks[0];
    expect(first?.monday).toBe('2027-06-07');
    expect(first?.isPartial).toBe(true);
    expect(first?.firstDayNeedingCover).toBe('2027-06-10');
    expect(first?.lastDayNeedingCover).toBe('2027-06-11');
  });

  it('closes with a partial week ending the day before school returns', () => {
    const last = weeks.at(-1);
    expect(last?.monday).toBe('2027-08-23');
    expect(last?.isPartial).toBe(true);
    expect(last?.firstDayNeedingCover).toBe('2027-08-23');
    expect(last?.lastDayNeedingCover).toBe('2027-08-24');
  });

  it('marks only the two boundary weeks partial', () => {
    const partials = weeks.filter((week) => week.isPartial).map((week) => week.index);
    expect(partials).toEqual([0, 11]);
  });
});

describe('summerWeeks — refusing bad input', () => {
  it('throws when school returns before it lets out', () => {
    expect(() => summerWeeks({ ...cleanBoundaries, firstDayOfSchool: '2027-05-01' })).toThrow(
      RangeError,
    );
  });

  it('throws when school returns on the same day it lets out', () => {
    expect(() => summerWeeks({ ...cleanBoundaries, firstDayOfSchool: '2027-06-11' })).toThrow(
      RangeError,
    );
  });

  it('throws when the gap contains no summer weekdays at all', () => {
    expect(() =>
      summerWeeks({
        ...cleanBoundaries,
        lastDayOfSchool: '2027-06-11',
        firstDayOfSchool: '2027-06-14',
      }),
    ).toThrow(/No summer weekdays/);
  });

  it('throws on a malformed date rather than producing an empty grid', () => {
    expect(() => summerWeeks({ ...cleanBoundaries, lastDayOfSchool: 'June 11' })).toThrow(
      RangeError,
    );
  });

  it('names the district and year in the error', () => {
    expect(() => summerWeeks({ ...cleanBoundaries, firstDayOfSchool: '2027-05-01' })).toThrow(
      /chesterfield 2027/,
    );
  });
});

describe('summerWeekIndexOf', () => {
  const weeks = summerWeeks(cleanBoundaries);

  it('finds the week containing a midweek date', () => {
    expect(summerWeekIndexOf(weeks, '2027-06-30')).toBe(2);
  });

  it('finds the week when the date is the Monday itself', () => {
    expect(summerWeekIndexOf(weeks, '2027-07-05')).toBe(3);
  });

  // A Saturday session belongs to the week it starts in, so the lookup window
  // closes on Sunday rather than Friday.
  it('includes the weekend that closes a week', () => {
    expect(summerWeekIndexOf(weeks, '2027-08-21')).toBe(9);
    expect(summerWeekIndexOf(weeks, '2027-08-22')).toBe(9);
  });

  it('returns null before summer starts', () => {
    expect(summerWeekIndexOf(weeks, '2027-06-13')).toBeNull();
  });

  it('returns null after summer ends', () => {
    expect(summerWeekIndexOf(weeks, '2027-08-23')).toBeNull();
  });

  it('throws on a malformed date', () => {
    expect(() => summerWeekIndexOf(weeks, 'whenever')).toThrow(RangeError);
  });
});
