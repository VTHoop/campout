import type { SchoolYearCalendar } from '@campout/planner';
import { CalendarType, longestPeriod, SchoolDistrict } from '@campout/planner';

/**
 * Placeholder landing page.
 *
 * It exists to prove the seam the whole app is built on: the pure planner
 * package (ADR-0008) imported and executed inside a React Server Component,
 * with no database, no clock, and no client bundle.
 *
 * The calendars below are hard-coded placeholders. Real district calendars are
 * reference data, and belong in Postgres. Summer is not stored on either one: it
 * is derived from the gap between the two (ADR-0013).
 */
const PLACEHOLDER_CALENDARS: readonly SchoolYearCalendar[] = [
  {
    district: SchoolDistrict.Chesterfield,
    type: CalendarType.Traditional,
    label: '2026-27',
    firstInstructionalDay: '2026-08-24',
    lastInstructionalDay: '2027-06-11',
    coversFrom: '2026-07-01',
    coversTo: '2027-06-30',
    closures: [],
  },
  {
    district: SchoolDistrict.Chesterfield,
    type: CalendarType.Traditional,
    label: '2027-28',
    firstInstructionalDay: '2027-08-23',
    lastInstructionalDay: '2028-06-09',
    coversFrom: '2027-07-01',
    coversTo: '2028-06-30',
    closures: [],
  },
];

export default function HomePage() {
  const summer = longestPeriod(PLACEHOLDER_CALENDARS, '2026-27');
  if (!summer) {
    throw new Error('The placeholder calendars must hold a summer between 2026-27 and 2027-28');
  }

  return (
    <main>
      <h1>Campout</h1>
      <p>Plan the days school is out.</p>
      <p data-testid="week-count">{summer.weeks.length} weeks of summer to cover in 2027.</p>
      <ol>
        {summer.weeks.map((week) => (
          <li key={week.monday}>
            Week {week.index + 1}: {week.monday} – {week.friday}
            {week.isPartial ? ' (partial)' : ''}
          </li>
        ))}
      </ol>
    </main>
  );
}
