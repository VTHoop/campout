import type { SchoolCalendar } from '@campout/planner';
import { SchoolDistrict, summerWeeks } from '@campout/planner';

/**
 * Placeholder landing page.
 *
 * It exists to prove the seam the whole app is built on: the pure planner
 * package (ADR-0008) imported and executed inside a React Server Component,
 * with no database, no clock, and no client bundle.
 *
 * The calendar below is a hard-coded placeholder. Real district calendars are
 * reference data, and belong in Postgres.
 */
const PLACEHOLDER_CALENDAR: SchoolCalendar = {
  district: SchoolDistrict.Chesterfield,
  year: 2027,
  lastDayOfSchool: '2027-06-11',
  firstDayOfSchool: '2027-08-23',
};

export default function HomePage() {
  const weeks = summerWeeks(PLACEHOLDER_CALENDAR);

  return (
    <main>
      <h1>Campout</h1>
      <p>Plan your kids’ summer, week by week.</p>
      <p data-testid="week-count">{weeks.length} weeks of summer to cover in 2027.</p>
      <ol>
        {weeks.map((week) => (
          <li key={week.monday}>
            Week {week.index + 1}: {week.monday} – {week.friday}
            {week.isPartial ? ' (partial)' : ''}
          </li>
        ))}
      </ol>
    </main>
  );
}
