import { describe, expect, it } from 'vitest';
import { longMonthDay, shortMonthDay } from './dates';

describe('shortMonthDay', () => {
  it.each([
    ['2027-06-14', 'Jun 14'],
    ['2027-07-05', 'Jul 5'],
    ['2027-08-16', 'Aug 16'],
  ])('writes %s as %s', (date, expected) => {
    expect(shortMonthDay(date)).toBe(expected);
  });

  it('keeps the calendar day at the start of the year, whatever the reader’s timezone', () => {
    expect(shortMonthDay('2027-01-01')).toBe('Jan 1');
  });
});

describe('longMonthDay', () => {
  it.each([
    ['2027-06-14', 'June 14'],
    ['2027-09-06', 'September 6'],
  ])('writes %s as %s', (date, expected) => {
    expect(longMonthDay(date)).toBe(expected);
  });
});
