import { describe, expect, it } from 'vitest';
import {
  addDays,
  assertCalendarDate,
  compareDates,
  daysBetween,
  firstWeekdayOnOrAfter,
  isWeekend,
  lastDayOfMonth,
  lastWeekdayOnOrBefore,
  mondayOf,
  monthOf,
  monthStart,
  nextWeekday,
  previousWeekday,
  Weekday,
  weekdayOf,
  yearOf,
} from './calendarDate';

describe('assertCalendarDate', () => {
  it('accepts a well-formed calendar date', () => {
    expect(assertCalendarDate('2027-06-14', 'date')).toBe('2027-06-14');
  });

  it('accepts a real leap day', () => {
    expect(assertCalendarDate('2028-02-29', 'date')).toBe('2028-02-29');
  });

  it.each([
    ['not a date at all', 'tomorrow'],
    ['a US-format date', '06/14/2027'],
    ['a timestamp rather than a calendar date', '2027-06-14T09:00:00Z'],
    ['a two-digit year', '27-06-14'],
  ])('rejects %s', (_label, value) => {
    expect(() => assertCalendarDate(value, 'lastInstructionalDay')).toThrow(RangeError);
  });

  it('rejects an impossible month', () => {
    expect(() => assertCalendarDate('2027-13-01', 'date')).toThrow(RangeError);
  });

  // Date.parse rolls 2027-02-30 forward to March 2 instead of failing. Without a
  // round-trip guard this would be accepted and every downstream week would shift.
  it('rejects a day that does not exist in that month rather than rolling it over', () => {
    expect(() => assertCalendarDate('2027-02-30', 'date')).toThrow(RangeError);
    expect(() => assertCalendarDate('2027-02-29', 'date')).toThrow(RangeError);
  });

  it('names the offending field in the error, so the caller knows which date was bad', () => {
    expect(() => assertCalendarDate('nope', 'firstInstructionalDay')).toThrow(
      /firstInstructionalDay/,
    );
  });
});

describe('addDays', () => {
  it('moves forward across a month boundary', () => {
    expect(addDays('2027-06-30', 1)).toBe('2027-07-01');
  });

  it('moves backward across a year boundary', () => {
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('handles a leap year', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  // The whole reason this module anchors to UTC: 2027-03-14 is the US spring-forward
  // date. A local-time implementation returns a 23-hour day here and drifts.
  it('is unaffected by daylight saving transitions', () => {
    expect(addDays('2027-03-13', 1)).toBe('2027-03-14');
    expect(addDays('2027-03-14', 1)).toBe('2027-03-15');
    expect(daysBetween('2027-03-13', '2027-03-15')).toBe(2);
  });

  it('returns the same date when shifted by zero', () => {
    expect(addDays('2027-06-14', 0)).toBe('2027-06-14');
  });
});

describe('weekdayOf', () => {
  it.each([
    ['2027-06-13', Weekday.Sunday],
    ['2027-06-14', Weekday.Monday],
    ['2027-06-11', Weekday.Friday],
    ['2027-08-21', Weekday.Saturday],
  ])('reads %s correctly', (date, expected) => {
    expect(weekdayOf(date)).toBe(expected);
  });
});

describe('isWeekend', () => {
  it('is true on Saturday and Sunday', () => {
    expect(isWeekend('2027-08-21')).toBe(true);
    expect(isWeekend('2027-06-13')).toBe(true);
  });

  it('is false on weekdays', () => {
    expect(isWeekend('2027-06-14')).toBe(false);
    expect(isWeekend('2027-06-11')).toBe(false);
  });
});

describe('compareDates', () => {
  it('orders two dates', () => {
    expect(compareDates('2027-06-14', '2027-06-21')).toBeLessThan(0);
    expect(compareDates('2027-06-21', '2027-06-14')).toBeGreaterThan(0);
  });

  it('returns zero for the same day', () => {
    expect(compareDates('2027-06-14', '2027-06-14')).toBe(0);
  });
});

describe('daysBetween', () => {
  it('counts forward', () => {
    expect(daysBetween('2027-06-14', '2027-06-21')).toBe(7);
  });

  it('counts backward as negative', () => {
    expect(daysBetween('2027-06-21', '2027-06-14')).toBe(-7);
  });
});

describe('mondayOf', () => {
  it('returns the date itself when it is already Monday', () => {
    expect(mondayOf('2027-06-14')).toBe('2027-06-14');
  });

  it('walks back from midweek', () => {
    expect(mondayOf('2027-06-17')).toBe('2027-06-14');
  });

  // Sunday closes the week that began six days earlier. Treating it as the start
  // of the next week is the classic Monday-anchored off-by-one.
  it('treats Sunday as the end of the preceding week, not the start of the next', () => {
    expect(mondayOf('2027-06-20')).toBe('2027-06-14');
  });

  it('walks back from Saturday', () => {
    expect(mondayOf('2027-06-19')).toBe('2027-06-14');
  });
});

describe('nextWeekday', () => {
  it('skips the weekend from a Friday', () => {
    expect(nextWeekday('2027-06-11')).toBe('2027-06-14');
  });

  it('returns the following day midweek', () => {
    expect(nextWeekday('2027-06-09')).toBe('2027-06-10');
  });

  it('returns Monday from a Saturday', () => {
    expect(nextWeekday('2027-06-12')).toBe('2027-06-14');
  });
});

describe('previousWeekday', () => {
  it('skips the weekend from a Monday', () => {
    expect(previousWeekday('2027-08-23')).toBe('2027-08-20');
  });

  it('returns the preceding day midweek', () => {
    expect(previousWeekday('2027-08-25')).toBe('2027-08-24');
  });

  it('returns Friday from a Sunday', () => {
    expect(previousWeekday('2027-08-22')).toBe('2027-08-20');
  });
});

describe('firstWeekdayOnOrAfter', () => {
  it('returns a weekday unchanged', () => {
    expect(firstWeekdayOnOrAfter('2027-06-11')).toBe('2027-06-11');
  });

  it('moves a Saturday to the following Monday', () => {
    expect(firstWeekdayOnOrAfter('2027-06-12')).toBe('2027-06-14');
  });

  it('moves a Sunday to the following Monday', () => {
    expect(firstWeekdayOnOrAfter('2027-06-13')).toBe('2027-06-14');
  });
});

describe('lastWeekdayOnOrBefore', () => {
  it('returns a weekday unchanged', () => {
    expect(lastWeekdayOnOrBefore('2027-06-14')).toBe('2027-06-14');
  });

  it('moves a Sunday to the preceding Friday', () => {
    expect(lastWeekdayOnOrBefore('2027-06-13')).toBe('2027-06-11');
  });

  it('moves a Saturday to the preceding Friday', () => {
    expect(lastWeekdayOnOrBefore('2027-06-12')).toBe('2027-06-11');
  });
});

describe('yearOf and monthOf', () => {
  it('read the year and the 1-based month', () => {
    expect(yearOf('2027-08-23')).toBe(2027);
    expect(monthOf('2027-08-23')).toBe(8);
  });
});

describe('monthStart', () => {
  it('pads a single-digit month', () => {
    expect(monthStart(2027, 9)).toBe('2027-09-01');
  });
});

describe('lastDayOfMonth', () => {
  it.each([
    ['a 31-day month', '2027-08-23', '2027-08-31'],
    ['a 30-day month', '2027-09-01', '2027-09-30'],
    ['February in a leap year', '2028-02-10', '2028-02-29'],
    ['February in a common year', '2027-02-10', '2027-02-28'],
    ['December, across the year end', '2027-12-01', '2027-12-31'],
  ])('finds the end of %s', (_label, date, expected) => {
    expect(lastDayOfMonth(date)).toBe(expected);
  });
});
