import { describe, expect, it } from 'vitest';
import { summerChoices } from './summers';
import type { SchoolYearCalendar } from './types';
import { CalendarType, PeriodBasis, SchoolDistrict } from './types';

/**
 * Fixture calendars. Invented, not scraped, but dated like Chesterfield's: school
 * starts the second-to-last Monday of August, so an estimated first day back
 * (ADR-0014) lands where the real one would.
 */
function schoolYear(label: string, first: string, last: string): SchoolYearCalendar {
  return {
    district: SchoolDistrict.Chesterfield,
    type: CalendarType.Traditional,
    label,
    firstInstructionalDay: first,
    lastInstructionalDay: last,
    coversFrom: first,
    coversTo: last,
    closures: [],
  };
}

/** Summer 2026 runs Sat May 30 – Sun Aug 23. */
const year2025 = schoolYear('2025-26', '2025-08-18', '2026-05-29');
/** Summer 2027 runs Sat Jun 5 – Sun Aug 22. */
const year2026 = schoolYear('2026-27', '2026-08-24', '2027-06-04');
/** Summer 2028 is estimated: Sat Jun 3 – Sun Aug 20, before Monday Aug 21. */
const year2027 = schoolYear('2027-28', '2027-08-23', '2028-06-02');

const threeYears = [year2027, year2025, year2026];

const yearsOf = (today: string, calendars = threeYears) =>
  summerChoices(calendars, today).summers.map((summer) => summer.year);

describe('summerChoices', () => {
  it('offers each summer between two consecutive loaded years, earliest first', () => {
    expect(yearsOf('2026-09-27')).toEqual([2026, 2027]);
  });

  it('dates each summer from the gap between its two school years', () => {
    const periods = summerChoices(threeYears, '2026-09-27').summers.map(({ period }) => period);
    expect(periods.map(({ closure }) => closure.startDate)).toEqual(['2026-05-30', '2027-06-05']);
    expect(periods.map(({ closure }) => closure.endDate)).toEqual(['2026-08-23', '2027-08-22']);
    expect(periods.map(({ basis }) => basis)).toEqual([
      PeriodBasis.Published,
      PeriodBasis.Published,
    ]);
  });

  it('defaults to the next summer to start while school is in session', () => {
    expect(summerChoices(threeYears, '2026-09-27').upcoming.year).toBe(2027);
  });

  it('defaults to the summer in progress', () => {
    expect(summerChoices(threeYears, '2027-07-15').upcoming.year).toBe(2027);
  });

  it.each(['2027-06-05', '2027-08-22'])('counts %s, an end of summer, as in progress', (today) => {
    expect(summerChoices(threeYears, today).upcoming.year).toBe(2027);
  });

  it('defaults to a summer the chooser offers', () => {
    const choices = summerChoices(threeYears, '2026-09-27');
    expect(choices.summers).toContain(choices.upcoming);
  });

  it('does not offer an estimated summer while the upcoming one is published', () => {
    const choices = summerChoices(threeYears, '2026-09-27');
    expect(choices.summers.map((summer) => summer.period.basis)).toEqual([
      PeriodBasis.Published,
      PeriodBasis.Published,
    ]);
  });

  // School is back on Aug 23 2027, and 2028-29 is not loaded.
  it('offers an estimated summer when the upcoming summer has no next year loaded', () => {
    const choices = summerChoices(threeYears, '2027-08-23');
    expect(choices.summers.map((summer) => summer.year)).toEqual([2026, 2027, 2028]);
    expect(choices.upcoming.year).toBe(2028);
    expect(choices.upcoming.period.basis).toBe(PeriodBasis.Estimated);
    expect(choices.upcoming.period.closure).toMatchObject({
      startDate: '2028-06-03',
      endDate: '2028-08-20',
    });
  });

  it('estimates the upcoming summer when only its own school year is loaded', () => {
    const choices = summerChoices([year2025, year2026], '2026-09-27');
    expect(choices.summers.map((summer) => summer.year)).toEqual([2026, 2027]);
    expect(choices.upcoming.period.basis).toBe(PeriodBasis.Estimated);
  });

  it('defaults to the latest summer when today is past every one', () => {
    const choices = summerChoices(threeYears, '2029-01-15');
    expect(choices.upcoming.year).toBe(2028);
    expect(choices.summers.map((summer) => summer.year)).toEqual([2026, 2027, 2028]);
  });

  // Starting Monday Oct 5, 2026-27's next first day is estimated as Oct 4 2027:
  // past Sep 15, so its summer cannot be resolved (ADR-0014).
  it('falls back to the latest published summer when the estimate fails its range check', () => {
    const lateStart = schoolYear('2026-27', '2026-10-05', '2027-06-04');
    const choices = summerChoices([year2025, lateStart], '2026-11-02');
    expect(choices.summers.map((summer) => summer.year)).toEqual([2026]);
    expect(choices.upcoming.year).toBe(2026);
  });

  it('throws when the calendars hold no summer at all', () => {
    const lateStart = schoolYear('2026-27', '2026-10-05', '2027-06-04');
    expect(() => summerChoices([lateStart], '2026-11-02')).toThrow(RangeError);
  });

  it('refuses a today that is not a calendar date', () => {
    expect(() => summerChoices(threeYears, '09/27/2026')).toThrow(RangeError);
  });
});
