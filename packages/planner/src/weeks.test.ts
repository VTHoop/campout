import { describe, expect, it } from 'vitest';
import { weeksBetween } from './weeks';

/**
 * Fixture ranges. Invented, not scraped — real district calendars are reference
 * data that belongs in the database, and these exist to pin the boundary
 * arithmetic rather than to be accurate.
 *
 * A range is the first and last day school is shut, inclusive: the day after the
 * last day of school through the day before school returns.
 */

/** School ends Friday June 11, returns Monday Aug 23: both boundary weeks are full. */
const cleanBoundaries = { start: '2027-06-12', end: '2027-08-22' };

/** School ends Wednesday June 9, returns Wednesday Aug 25: both boundary weeks are partial. */
const midweekBoundaries = { start: '2027-06-10', end: '2027-08-24' };

describe('weeksBetween — clean Friday-to-Monday boundaries', () => {
  const weeks = weeksBetween(cleanBoundaries.start, cleanBoundaries.end);

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

describe('weeksBetween — midweek boundaries', () => {
  const weeks = weeksBetween(midweekBoundaries.start, midweekBoundaries.end);

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

// The same arithmetic has to hold when the run is one day or one week, because a
// scattered day off is the same shape as summer, only shorter (ADR-0013).
describe('weeksBetween — short runs', () => {
  it('turns a single Tuesday into one partial week covering only that day', () => {
    const weeks = weeksBetween('2027-11-02', '2027-11-02');

    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.monday).toBe('2027-11-01');
    expect(weeks[0]?.friday).toBe('2027-11-05');
    expect(weeks[0]?.isPartial).toBe(true);
    expect(weeks[0]?.firstDayNeedingCover).toBe('2027-11-02');
    expect(weeks[0]?.lastDayNeedingCover).toBe('2027-11-02');
  });

  it('treats a Monday-to-Friday run as one full week', () => {
    const weeks = weeksBetween('2027-03-29', '2027-04-02');

    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.isPartial).toBe(false);
  });

  it('starts a run that opens on a Saturday at the following Monday', () => {
    const weeks = weeksBetween('2027-06-12', '2027-06-16');

    expect(weeks[0]?.monday).toBe('2027-06-14');
    expect(weeks[0]?.firstDayNeedingCover).toBe('2027-06-14');
    expect(weeks[0]?.lastDayNeedingCover).toBe('2027-06-16');
    expect(weeks[0]?.isPartial).toBe(true);
  });

  it('ends a run that closes on a Sunday at the Friday before', () => {
    const weeks = weeksBetween('2027-06-09', '2027-06-13');

    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.firstDayNeedingCover).toBe('2027-06-09');
    expect(weeks[0]?.lastDayNeedingCover).toBe('2027-06-11');
  });
});

describe('weeksBetween — refusing bad input', () => {
  it('throws when the range ends before it starts', () => {
    expect(() => weeksBetween('2027-06-12', '2027-05-01')).toThrow(RangeError);
  });

  it('throws when the range ends the day before it starts', () => {
    expect(() => weeksBetween('2027-06-12', '2027-06-11')).toThrow(RangeError);
  });

  it('throws when the range holds no weekdays at all', () => {
    expect(() => weeksBetween('2027-06-12', '2027-06-13')).toThrow(/No weekdays/);
  });

  it('throws on a malformed start rather than producing an empty grid', () => {
    expect(() => weeksBetween('June 12', '2027-08-22')).toThrow(RangeError);
  });

  it('throws on a malformed end rather than producing an empty grid', () => {
    expect(() => weeksBetween('2027-06-12', 'August 22')).toThrow(RangeError);
  });

  it('names both dates in the error', () => {
    expect(() => weeksBetween('2027-06-12', '2027-05-01')).toThrow(/2027-06-12.*2027-05-01/);
  });
});
