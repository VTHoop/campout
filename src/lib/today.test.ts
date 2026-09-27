import { describe, expect, it } from 'vitest';
import { richmondDate } from './today';

describe('richmondDate', () => {
  it('is the calendar date in Richmond at that instant', () => {
    expect(richmondDate(new Date('2026-09-27T16:00:00Z'))).toBe('2026-09-27');
  });

  // 10pm on Sunday Aug 22 in Richmond is already Monday in UTC.
  it('keeps Richmond’s date late in the evening, when UTC has moved on', () => {
    expect(richmondDate(new Date('2027-08-23T02:00:00Z'))).toBe('2027-08-22');
  });

  it('follows standard time in winter', () => {
    expect(richmondDate(new Date('2027-01-01T04:30:00Z'))).toBe('2026-12-31');
  });
});
