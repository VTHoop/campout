import { Button } from '@/components/ui/button';
import {
  type Registration,
  RegistrationKind,
  type SessionCardView,
} from '@/lib/catalog/session-cards';
import { Category } from '@/lib/catalog/types';
import {
  formatAges,
  formatGrades,
  formatHours,
  formatPrice,
  partialWeekCallout,
  weekTab,
} from '@/lib/session-card-format';
import { cn } from '@/lib/utils';

/**
 * The session card (CAM-32; DESIGN.md → *The session card*; Design Foundation
 * p.2). One dated offering: the week tab on the left, the camp's facts on the
 * right. It says what the camp told us — a fact the camp did not state is said
 * to be missing, never defaulted — and it ranks nothing.
 *
 * Not yet on the card: distance (CAM-28), Add to plan (the planner) and the
 * verified line (real data).
 */

const CATEGORY_LABELS = new Map(
  Object.entries({
    [Category.Sports]: 'Sports',
    [Category.STEM]: 'STEM',
    [Category.Arts]: 'Arts',
    [Category.Outdoors]: 'Outdoors',
    [Category.Academic]: 'Academic',
    [Category.FaithBased]: 'Faith-based',
  } satisfies Record<Category, string>),
);

/** Whole class names, so Tailwind can see each one. */
const CATEGORY_DOTS = new Map(
  Object.entries({
    [Category.Sports]: 'bg-category-sports',
    [Category.STEM]: 'bg-category-stem',
    [Category.Arts]: 'bg-category-arts',
    [Category.Outdoors]: 'bg-category-outdoors',
    [Category.Academic]: 'bg-category-academic',
    [Category.FaithBased]: 'bg-category-faith-based',
  } satisfies Record<Category, string>),
);

function WeekTab({ card, weekNumber }: { card: SessionCardView; weekNumber: number }) {
  const tab = weekTab(card.startDate, card.endDate);
  const week = `Week ${String(weekNumber)}`;
  return (
    <div
      data-testid="week-tab"
      className="flex w-20 shrink-0 flex-col border-rule border-r lg:w-28"
    >
      <span className="sr-only">{`${week}, ${tab.spoken}`}</span>
      <div aria-hidden="true" className="flex flex-1 flex-col">
        <span className="bg-ink px-2 py-1 text-center text-caption font-semibold text-paper">
          {week}
        </span>
        <div className="flex flex-1 flex-col items-center justify-center bg-tint px-1 py-4 text-center tabular-nums">
          <span className="text-caption text-ink-muted">{tab.month}</span>
          <span className="font-display text-title font-bold text-ink lg:text-heading">
            {tab.range}
          </span>
          <span
            className={cn(
              'text-caption',
              tab.fullWeek ? 'text-ink-muted' : 'font-semibold text-brick',
            )}
          >
            {tab.days}
          </span>
        </div>
      </div>
    </div>
  );
}

function NotStated({ children }: { children: string }) {
  return <span className="font-normal italic text-ink-muted">{children}</span>;
}

function DataRow({ card }: { card: SessionCardView }) {
  const hours = formatHours(card.startTime, card.endTime);
  const price = formatPrice(card.priceCents);
  const ranges = [formatAges(card.ageRange), formatGrades(card.gradeRange)].filter(
    (range) => range !== undefined,
  );
  return (
    <div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-ui font-semibold text-ink tabular-nums">
        {hours === undefined ? <NotStated>Hours not stated</NotStated> : <span>{hours}</span>}
        {ranges.map((range) => (
          <span key={range}>{range}</span>
        ))}
        {price === undefined ? <NotStated>Price not stated</NotStated> : <span>{price}</span>}
      </p>
      {card.priceNote === undefined ? null : (
        <p className="mt-1 text-caption text-ink-muted">{card.priceNote}</p>
      )}
    </div>
  );
}

function Categories({ categories }: { categories: SessionCardView['categories'] }) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted">
      {categories.map((category) => (
        <span key={category} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn('size-2 rounded-full', CATEGORY_DOTS.get(category))}
          />
          <span>{CATEGORY_LABELS.get(category)}</span>
        </span>
      ))}
    </p>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="mt-px size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function Callout({ card }: { card: SessionCardView }) {
  const callout = partialWeekCallout(card.startDate, card.endDate, card.endTime);
  if (callout === undefined) return null;
  return (
    <p className="flex gap-2 rounded-control border border-marigold bg-marigold-wash px-3 py-2 text-caption text-ink">
      <ClockIcon />
      <span>{callout}</span>
    </p>
  );
}

function registrationLink(registration: Registration): { href: string; label: string } {
  switch (registration.kind) {
    case RegistrationKind.Register:
      return { href: registration.url, label: "Register on the camp's site" };
    case RegistrationKind.Call:
      return { href: `tel:${registration.phone}`, label: `Call ${registration.phone}` };
    case RegistrationKind.Website:
      return { href: registration.url, label: "Camp's site" };
  }
}

function Actions({ card }: { card: SessionCardView }) {
  if (card.registration === undefined && card.registrationNotes === undefined) return null;
  const link = card.registration && registrationLink(card.registration);
  return (
    <div className="flex flex-col gap-2">
      {link === undefined ? null : (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="whitespace-normal text-blueprint">
            <a href={link.href}>{link.label}</a>
          </Button>
        </div>
      )}
      {card.registrationNotes === undefined ? null : (
        <p className="text-caption text-ink-muted">{card.registrationNotes}</p>
      )}
    </div>
  );
}

export function SessionCard({ card, weekNumber }: { card: SessionCardView; weekNumber: number }) {
  const headingId = `${card.id}-name`;
  return (
    <li
      aria-labelledby={headingId}
      className="flex overflow-hidden rounded-card border border-rule bg-surface"
    >
      <WeekTab card={card} weekNumber={weekNumber} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="border-rule border-b pb-3">
          <h3 id={headingId} className="text-title text-ink">
            {card.campName}
          </h3>
          <p className="text-caption text-ink-muted">
            {card.providerName} at {card.locationName}, {card.city}
          </p>
        </div>
        <DataRow card={card} />
        <Categories categories={card.categories} />
        <Callout card={card} />
        <Actions card={card} />
      </div>
    </li>
  );
}
