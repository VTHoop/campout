import { describe, expect, it } from 'vitest';
import {
  formatAges,
  formatGrades,
  formatHours,
  formatPrice,
  formatVerifiedOn,
  partialWeekCallout,
  weekTab,
} from './session-card-format';

/**
 * The session card's facts, as a parent reads them (CAM-32; Design Foundation
 * p.2). A fact the source did not state comes back `undefined`, so the card can
 * say so rather than show a default.
 */

describe('formatHours', () => {
  it.each([
    ['09:00', '14:00', '9:00am – 2:00pm'],
    ['10:30', '13:30', '10:30am – 1:30pm'],
    ['09:00', '12:00', '9:00am – 12:00pm'],
    ['00:15', '23:45', '12:15am – 11:45pm'],
  ])('writes %s to %s as %s', (start, end, hours) => {
    expect(formatHours(start, end)).toBe(hours);
  });

  it.each([
    ['no start', undefined, '14:00'],
    ['no end', '09:00', undefined],
    ['neither', undefined, undefined],
  ])('is not stated with %s', (_case, start, end) => {
    expect(formatHours(start, end)).toBeUndefined();
  });
});

describe('formatPrice', () => {
  it.each([
    [41_500, '$415'],
    [29_900, '$299'],
    [29_950, '$299.50'],
    [125_000, '$1,250'],
  ])('writes %i cents as %s', (cents, price) => {
    expect(formatPrice(cents)).toBe(price);
  });

  it('is not stated without a price', () => {
    expect(formatPrice(undefined)).toBeUndefined();
  });
});

describe('formatAges', () => {
  it.each([
    [{ min: 5, max: 15 }, 'Ages 5–15'],
    [{ min: 5 }, 'Ages 5 and up'],
    [{ max: 15 }, 'Ages up to 15'],
  ])('writes %o as %s', (range, ages) => {
    expect(formatAges(range)).toBe(ages);
  });

  it.each([undefined, {}])('omits ages when the range is %o', (range) => {
    expect(formatAges(range)).toBeUndefined();
  });
});

describe('formatGrades', () => {
  it.each([
    [{ min: 0, max: 5 }, 'Grades K–5'],
    [{ min: 3, max: 8 }, 'Grades 3–8'],
    [{ min: 0 }, 'Grades K and up'],
    [{ max: 5 }, 'Grades up to 5'],
  ])('writes %o as %s', (range, grades) => {
    expect(formatGrades(range)).toBe(grades);
  });

  it.each([undefined, {}])('omits grades when the range is %o', (range) => {
    expect(formatGrades(range)).toBeUndefined();
  });
});

describe('weekTab', () => {
  it('describes a Monday-to-Friday session', () => {
    expect(weekTab('2026-06-15', '2026-06-19')).toEqual({
      month: 'Jun',
      range: '15–19',
      days: 'Mon–Fri',
      fullWeek: true,
      spoken: 'June 15 to 19, Monday to Friday',
    });
  });

  it('marks a Monday-to-Wednesday session as short of a full week', () => {
    expect(weekTab('2026-08-03', '2026-08-05')).toEqual({
      month: 'Aug',
      range: '3–5',
      days: 'Mon–Wed',
      fullWeek: false,
      spoken: 'August 3 to 5, Monday to Wednesday',
    });
  });

  it('names both months when a session crosses into the next', () => {
    expect(weekTab('2026-06-29', '2026-07-03')).toEqual({
      month: 'Jun–Jul',
      range: '29–3',
      days: 'Mon–Fri',
      fullWeek: true,
      spoken: 'June 29 to July 3, Monday to Friday',
    });
  });

  it('describes a one-day session by its day alone', () => {
    expect(weekTab('2026-06-17', '2026-06-17')).toEqual({
      month: 'Jun',
      range: '17',
      days: 'Wed',
      fullWeek: false,
      spoken: 'June 17, Wednesday',
    });
  });
});

describe('partialWeekCallout', () => {
  it('says nothing for a session covering all five weekdays', () => {
    expect(partialWeekCallout('2026-06-15', '2026-06-19', '14:00')).toBeUndefined();
  });

  it('counts the weekdays a shorter session covers', () => {
    expect(partialWeekCallout('2026-06-15', '2026-06-18', '16:30')).toBe('Covers 4 of 5 days');
  });

  it.each([
    ['at noon', '12:00'],
    ['before noon', '11:30'],
  ])('adds that it ends at noon when it ends %s', (_case, endTime) => {
    expect(partialWeekCallout('2026-08-03', '2026-08-05', endTime)).toBe(
      'Covers 3 of 5 days, and ends at noon',
    );
  });

  it.each([
    ['after noon', '12:30'],
    ['at an unstated time', undefined],
  ])('does not say it ends at noon when it ends %s', (_case, endTime) => {
    expect(partialWeekCallout('2026-08-03', '2026-08-05', endTime)).toBe('Covers 3 of 5 days');
  });
});

describe('formatVerifiedOn', () => {
  it.each([
    ['2026-09-01', 'Sep 1, 2026'],
    ['2027-12-25', 'Dec 25, 2027'],
    ['2028-02-29', 'Feb 29, 2028'],
  ])('writes %s as %s', (date, written) => {
    expect(formatVerifiedOn(date)).toBe(written);
  });
});
