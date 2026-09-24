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
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-display text-ink">Campout</h1>
      <p className="mt-3 text-body text-ink-muted">Plan the days school is out.</p>
      <section className="mt-8 rounded-card border border-rule bg-surface">
        <p
          data-testid="week-count"
          className="border-rule border-b px-4 py-3 font-display text-title tabular-nums"
        >
          {summer.weeks.length} weeks of summer to cover in 2027.
        </p>
        <ol className="divide-y divide-rule">
          {summer.weeks.map((week) => (
            <li key={week.monday} className="px-4 py-3 text-ui tabular-nums">
              Week {week.index + 1}: {week.monday} – {week.friday}
              {week.isPartial ? <span className="font-semibold text-brick"> (partial)</span> : null}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
