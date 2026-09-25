import type { SchoolYearCalendar } from '@campout/planner';
import { CalendarType, longestPeriod, SchoolDistrict, yearOf } from '@campout/planner';
import type { Metadata } from 'next';
import { WeekPicker } from '@/components/week-picker';
import { districtName } from '@/lib/districts';

/**
 * The Summer page, so far: summer's weeks as the week picker (CAM-30).
 *
 * The planner package (ADR-0008) derives the weeks inside this React Server
 * Component, with no database and no clock; only the picker ships to the client.
 *
 * The calendars below are hard-coded placeholders. Real district calendars are
 * reference data, and belong in Postgres. Summer is not stored on either one: it
 * is derived from the gap between the two (ADR-0013).
 */
const PLACEHOLDER_DISTRICT = SchoolDistrict.Chesterfield;

const PLACEHOLDER_CALENDARS: readonly SchoolYearCalendar[] = [
  {
    district: PLACEHOLDER_DISTRICT,
    type: CalendarType.Traditional,
    label: '2026-27',
    firstInstructionalDay: '2026-08-24',
    lastInstructionalDay: '2027-06-11',
    coversFrom: '2026-07-01',
    coversTo: '2027-06-30',
    closures: [],
  },
  {
    district: PLACEHOLDER_DISTRICT,
    type: CalendarType.Traditional,
    label: '2027-28',
    firstInstructionalDay: '2027-08-23',
    lastInstructionalDay: '2028-06-09',
    coversFrom: '2027-07-01',
    coversTo: '2028-06-30',
    closures: [],
  },
];

export const metadata: Metadata = { title: 'Summer' };

export default function SummerPage() {
  const summer = longestPeriod(PLACEHOLDER_CALENDARS, '2026-27');
  if (!summer) {
    throw new Error('The placeholder calendars must hold a summer between 2026-27 and 2027-28');
  }

  const district = districtName(PLACEHOLDER_DISTRICT);
  const firstWeek = summer.weeks.at(0);
  if (!firstWeek) throw new Error('A summer always holds at least one week');

  return (
    <main>
      <h1 className="px-4 pt-6 font-display text-heading text-ink lg:px-6">Summer</h1>
      <section
        aria-labelledby="your-summer"
        className="mt-4 flex flex-col gap-3 border-rule border-y bg-surface px-4 py-3 lg:flex-row lg:items-center lg:gap-6 lg:px-6"
      >
        <div className="shrink-0">
          <h2 id="your-summer" className="text-ui font-semibold text-ink">
            Your summer
          </h2>
          <p className="text-caption tabular-nums text-ink-muted">
            {district}, {yearOf(firstWeek.monday)} · {summer.weeks.length} weeks
          </p>
        </div>
        <WeekPicker weeks={summer.weeks} />
      </section>
    </main>
  );
}
