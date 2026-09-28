import type { CalendarDate, SummerChoice, SummerChoices } from '@campout/planner';
import { SchoolDistrict, summerChoices } from '@campout/planner';
import { SummerChooser } from '@/components/summer-chooser';
import { WeekPicker } from '@/components/week-picker';
import { CHESTERFIELD_CALENDARS } from '@/lib/calendars/chesterfield';
import type { SessionCardView } from '@/lib/catalog/session-cards';
import { districtName } from '@/lib/districts';

/**
 * The Summer page's body: a summer chooser over the chosen summer's weeks
 * (CAM-30, CAM-31).
 *
 * The planner package (ADR-0008) derives the summers inside this React Server
 * Component, with no database and no clock: `today` is passed in. Summer is not
 * stored on any calendar; it is derived from the gap between two (ADR-0013).
 */
const DISTRICT = SchoolDistrict.Chesterfield;

/** The summer the URL names, or the upcoming one when it names none on offer. */
function chosenSummer(
  { summers, upcoming }: SummerChoices,
  requested: string | string[] | undefined,
): SummerChoice {
  if (typeof requested !== 'string') return upcoming;
  return summers.find((summer) => String(summer.year) === requested) ?? upcoming;
}

export function SummerView({
  today,
  requested,
}: {
  today: CalendarDate;
  requested: string | string[] | undefined;
  cards: readonly SessionCardView[];
}) {
  const choices = summerChoices(CHESTERFIELD_CALENDARS, today);
  const { year, period } = chosenSummer(choices, requested);

  return (
    <main>
      <section
        aria-labelledby="your-summer"
        className="flex flex-col gap-3 border-rule border-b bg-surface px-4 py-3 lg:flex-row lg:items-center lg:gap-6 lg:px-6"
      >
        <div className="flex shrink-0 flex-col gap-2">
          <div>
            <h1 id="your-summer" className="text-ui font-semibold text-ink">
              Your summer
            </h1>
            <p className="text-caption tabular-nums text-ink-muted">
              {districtName(DISTRICT)}, {year} · {period.weeks.length} weeks
            </p>
          </div>
          <SummerChooser years={choices.summers.map((summer) => summer.year)} selected={year} />
        </div>
        {/* Keyed by summer, so switching summers starts the picker again at week 1. */}
        <WeekPicker key={year} weeks={period.weeks} selected={0} onSelect={() => undefined} />
      </section>
    </main>
  );
}
