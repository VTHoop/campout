import { describe, expect, it } from 'vitest';
import { estimateNextFirstDay } from './estimate';
import { EstimateRule } from './types';

/**
 * The rules come from ADR-0014. The dates in the first block are the
 * real first days of the four Richmond-metro districts, checked during
 * refinement: every one started the second-to-last Monday of August.
 */

describe('estimateNextFirstDay — weekday from the end of the month', () => {
  it.each([
    ['2024-08-19', '2025-08-18'],
    // August 2026 has five Mondays. Counting from the start of the month would
    // say Aug 17 and miss by a week; counting back from the end does not.
    ['2025-08-18', '2026-08-24'],
    ['2026-08-24', '2027-08-23'],
  ])('estimates the year after one starting %s as %s', (firstDay, expected) => {
    expect(estimateNextFirstDay(firstDay)).toEqual({
      firstDay: expected,
      rule: EstimateRule.WeekdayFromMonthEnd,
    });
  });

  it('keeps the weekday: the last Wednesday of August stays the last Wednesday', () => {
    expect(estimateNextFirstDay('2027-08-25')).toEqual({
      firstDay: '2028-08-30',
      rule: EstimateRule.WeekdayFromMonthEnd,
    });
  });

  // A year-round calendar is estimated by the same rules (ADR-0014).
  it('estimates a late-July start the same way', () => {
    expect(estimateNextFirstDay('2026-07-27')).toEqual({
      firstDay: '2027-07-26',
      rule: EstimateRule.WeekdayFromMonthEnd,
    });
  });

  // Eight days after Labor Day is outside the anchor's one-week reach.
  it('uses the month-end rule a day past the Labor Day window', () => {
    expect(estimateNextFirstDay('2026-09-15')).toEqual({
      firstDay: '2027-09-14',
      rule: EstimateRule.WeekdayFromMonthEnd,
    });
  });
});

describe('estimateNextFirstDay — Labor Day anchor', () => {
  // Labor Day is Sep 7 2026 and Sep 6 2027.
  it('keeps "the Tuesday after Labor Day"', () => {
    expect(estimateNextFirstDay('2026-09-08')).toEqual({
      firstDay: '2027-09-07',
      rule: EstimateRule.LaborDayAnchor,
    });
  });

  // Eight days before a Monday Labor Day is always a Sunday. Unrealistic as a
  // first day, but it is the tightest miss on that side of the window.
  it('uses the month-end rule a day before the Labor Day window', () => {
    expect(estimateNextFirstDay('2026-08-30')).toEqual({
      firstDay: '2027-08-29',
      rule: EstimateRule.WeekdayFromMonthEnd,
    });
  });

  it.each([
    ['a week before', '2026-08-31', '2027-08-30'],
    ['a week after', '2026-09-14', '2027-09-13'],
  ])('anchors a first day exactly %s Labor Day', (_label, firstDay, expected) => {
    expect(estimateNextFirstDay(firstDay)).toEqual({
      firstDay: expected,
      rule: EstimateRule.LaborDayAnchor,
    });
  });
});

describe('estimateNextFirstDay — range check', () => {
  it.each([
    ['Jul 1', '2026-07-02', '2027-07-01'],
    ['Sep 15', '2026-09-16', '2027-09-15'],
  ])('accepts an estimate on %s', (_label, firstDay, expected) => {
    expect(estimateNextFirstDay(firstDay)?.firstDay).toBe(expected);
  });

  // An estimate outside Jul 1 - Sep 15 is more likely wrong than useful, so
  // summer's end stays not published yet.
  it.each([
    ['before Jul 1', '2026-06-29'],
    ['after Sep 15', '2026-09-17'],
    ['in June', '2026-06-22'],
  ])('gives no estimate when it would land %s', (_label, firstDay) => {
    expect(estimateNextFirstDay(firstDay)).toBeUndefined();
  });

  it('throws on a malformed date', () => {
    expect(() => estimateNextFirstDay('August')).toThrow(RangeError);
  });
});
