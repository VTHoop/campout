import { describe, expect, it } from 'vitest';
import {
  agesValue,
  endsEarly,
  formatAddress,
  formatAges,
  formatGrades,
  formatHours,
  formatPrice,
  formatVerifiedOn,
  gradesValue,
  locationLine,
  weekBar,
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

describe('agesValue and gradesValue', () => {
  it.each([
    [{ min: 5, max: 15 }, '5–15'],
    [{ min: 5 }, '5 and up'],
    [{ max: 15 }, 'up to 15'],
  ])('writes the ages %o as %s, without the word Ages', (range, ages) => {
    expect(agesValue(range)).toBe(ages);
  });

  it.each([
    [{ min: 0, max: 5 }, 'K–5'],
    [{ min: 3, max: 8 }, '3–8'],
    [{ min: 0 }, 'K and up'],
    [{ max: 5 }, 'up to 5'],
  ])('writes the grades %o as %s, without the word Grades', (range, grades) => {
    expect(gradesValue(range)).toBe(grades);
  });

  it.each([undefined, {}])('omits both when the range is %o', (range) => {
    expect(agesValue(range)).toBeUndefined();
    expect(gradesValue(range)).toBeUndefined();
  });
});

describe('weekBar', () => {
  it('fills all five days for a Monday-to-Friday session', () => {
    expect(weekBar('2026-06-15', '2026-06-19')).toEqual([true, true, true, true, true]);
  });

  it('fills Monday to Wednesday and leaves Thursday and Friday hollow', () => {
    expect(weekBar('2026-08-03', '2026-08-05')).toEqual([true, true, true, false, false]);
  });

  it('fills only Friday for a Friday-only session', () => {
    expect(weekBar('2027-06-11', '2027-06-11')).toEqual([false, false, false, false, true]);
  });

  it('leaves Monday hollow for a Tuesday-to-Friday session', () => {
    expect(weekBar('2026-06-16', '2026-06-19')).toEqual([false, true, true, true, true]);
  });

  it('fills every weekday of a session that runs into a second week', () => {
    expect(weekBar('2026-06-15', '2026-06-26')).toEqual([true, true, true, true, true]);
  });
});

describe('endsEarly', () => {
  it.each([
    ['11:30', true],
    ['12:30', true],
    ['14:59', true],
    ['15:00', false],
    ['17:00', false],
  ])('is %s → %s', (endTime, early) => {
    expect(endsEarly(endTime)).toBe(early);
  });

  it('says nothing when the end time is not stated', () => {
    expect(endsEarly(undefined)).toBe(false);
  });
});

describe('locationLine', () => {
  it('names the location when it is not the provider', () => {
    expect(locationLine('Fixture Provider', 'Fixture Park', 'Chester')).toBe(
      'Fixture Provider at Fixture Park, Chester',
    );
  });

  it('names the provider once when the location has the same name', () => {
    expect(locationLine('Fixture Gym', 'Fixture Gym', 'Chester')).toBe('Fixture Gym, Chester');
  });

  it('ignores a trailing acronym in parentheses on the provider', () => {
    expect(
      locationLine('Sports Center of Richmond (SCOR)', 'Sports Center of Richmond', 'Richmond'),
    ).toBe('Sports Center of Richmond (SCOR), Richmond');
  });

  it('ignores case and surrounding whitespace', () => {
    expect(locationLine('Fixture Gym', '  fixture gym ', 'Chester')).toBe('Fixture Gym, Chester');
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

describe('formatAddress', () => {
  it('writes the street, then city, state and postal code, on one line', () => {
    expect(
      formatAddress({
        street: '18 Kiln Hill Ln',
        city: 'Ashland',
        state: 'VA',
        postalCode: '23005',
      }),
    ).toBe('18 Kiln Hill Ln, Ashland, VA 23005');
  });
});
