import { describe, expect, it } from 'vitest';
import { summerWindow } from './summer-window';

/**
 * The window of sessions the Find camps page reads (CAM-28 review): one summer,
 * so the read stays bounded as the catalog grows. Chesterfield's loaded
 * calendars give summer 2026 twelve weeks from Monday June 1 and summer 2027
 * eleven from Monday June 7 (see `camps/page.test.tsx`).
 */

const SEPTEMBER_2026 = '2026-09-27';

describe('summerWindow', () => {
  it('runs from the first Monday to the last Friday of the summer asked for', () => {
    expect(summerWindow(SEPTEMBER_2026, '2026')).toEqual({
      start: '2026-06-01',
      end: '2026-08-21',
    });
  });

  it('is the upcoming summer when none is asked for', () => {
    expect(summerWindow(SEPTEMBER_2026, undefined)).toEqual({
      start: '2027-06-07',
      end: '2027-08-20',
    });
  });

  it.each([
    ['a summer not on offer', '2019'],
    ['a value that is not a year', 'summer'],
    ['a repeated parameter', ['2026', '2027']],
  ])('falls back to the upcoming summer for %s', (_case, requested) => {
    expect(summerWindow(SEPTEMBER_2026, requested)).toEqual({
      start: '2027-06-07',
      end: '2027-08-20',
    });
  });
});
