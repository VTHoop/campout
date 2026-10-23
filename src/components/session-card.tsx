'use client';

import { useRef } from 'react';
import { ApproveControls, type OnApprove } from '@/components/approve-controls';
import { StatusPill } from '@/components/status-pill';
import {
  type Registration,
  RegistrationKind,
  type SessionCardView,
  VerificationKind,
} from '@/lib/catalog/session-cards';
import { Category } from '@/lib/catalog/types';
import {
  agesValue,
  endsEarly,
  formatHours,
  formatPrice,
  formatVerifiedOn,
  gradesValue,
  locationLine,
  weekBar,
  weekTab,
} from '@/lib/session-card-format';
import { cn } from '@/lib/utils';

/**
 * The session card (CAM-32, redesigned in CAM-51; DESIGN.md → *The session
 * card*). One dated offering: the date block on the left, the camp's facts on
 * the right. It says what the camp told us — a fact the camp did not state is
 * said to be missing, never defaulted — and it ranks nothing.
 *
 * Not yet on the card: the distance itself (CAM-45 fills the `— mi` slot) and
 * Add to plan (the planner).
 */

const CATEGORY_LABELS = new Map(
  Object.entries({
    [Category.DayCamp]: 'Day camp',
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
    [Category.DayCamp]: 'bg-category-day-camp',
    [Category.Sports]: 'bg-category-sports',
    [Category.STEM]: 'bg-category-stem',
    [Category.Arts]: 'bg-category-arts',
    [Category.Outdoors]: 'bg-category-outdoors',
    [Category.Academic]: 'bg-category-academic',
    [Category.FaithBased]: 'bg-category-faith-based',
  } satisfies Record<Category, string>),
);

function BarDay({ running }: { running: boolean }) {
  return (
    <span
      data-testid="week-bar-day"
      data-covered={String(running)}
      className={cn('h-1.5 w-3 border border-ink', running && 'bg-ink')}
    />
  );
}

/** Monday to Friday, filled where the session runs. A decoration: the spoken label has the days. */
function WeekBar({ days }: { days: readonly boolean[] }) {
  const [monday, tuesday, wednesday, thursday, friday] = days;
  return (
    <div data-testid="week-bar" aria-hidden="true" className="mt-2 flex gap-0.5">
      <BarDay running={monday === true} />
      <BarDay running={tuesday === true} />
      <BarDay running={wednesday === true} />
      <BarDay running={thursday === true} />
      <BarDay running={friday === true} />
    </div>
  );
}

function DateBlock({ card, weekNumber }: { card: SessionCardView; weekNumber: number }) {
  const tab = weekTab(card.startDate, card.endDate);
  const week = `Week ${String(weekNumber)}`;
  return (
    <div
      data-testid="week-tab"
      className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 border-rule border-r bg-tint px-1 py-4 text-center tabular-nums sm:w-24"
    >
      <span className="sr-only">{`${week}, ${tab.spoken}`}</span>
      <div aria-hidden="true" className="flex flex-col items-center gap-1">
        <span className="text-caption text-ink-muted">{tab.month}</span>
        <span className="font-display text-title font-bold text-ink sm:text-heading">
          {tab.range}
        </span>
        {tab.fullWeek ? null : <WeekBar days={weekBar(card.startDate, card.endDate)} />}
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
  );
}

function NotStated({ children }: { children: string }) {
  return <span className="font-normal italic text-ink-muted">{children}</span>;
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

function Price({ priceCents }: { priceCents: SessionCardView['priceCents'] }) {
  const price = formatPrice(priceCents);
  if (price === undefined)
    return (
      <span className="text-ui">
        <NotStated>Price not stated</NotStated>
      </span>
    );
  return <span className="font-display text-heading font-bold text-ink tabular-nums">{price}</span>;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className="text-ui font-semibold text-ink tabular-nums">{children}</dd>
    </div>
  );
}

function Facts({ card }: { card: SessionCardView }) {
  const hours = formatHours(card.startTime, card.endTime);
  const ages = agesValue(card.ageRange);
  const grades = gradesValue(card.gradeRange);
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2">
      <Fact label="Hours">
        {hours === undefined ? <NotStated>Hours not stated</NotStated> : hours}
        {endsEarly(card.endTime) ? (
          <span className="mt-0.5 flex items-center gap-1 text-caption font-semibold">
            <ClockIcon />
            <span>Ends early</span>
          </span>
        ) : null}
      </Fact>
      {ages === undefined ? null : <Fact label="Ages">{ages}</Fact>}
      {grades === undefined ? null : <Fact label="Grades">{grades}</Fact>}
    </dl>
  );
}

function Categories({ categories }: { categories: SessionCardView['categories'] }) {
  return (
    <>
      {categories.map((category) => (
        <span key={category} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn('size-2 rounded-full', CATEGORY_DOTS.get(category))}
          />
          <span>{CATEGORY_LABELS.get(category)}</span>
        </span>
      ))}
    </>
  );
}

/** Where, how far (`— mi` until CAM-45 measures it), and what kind. */
function LocationLine({ card }: { card: SessionCardView }) {
  return (
    <p
      data-testid="location-line"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted"
    >
      <span>{locationLine(card.providerName, card.locationName, card.city)}</span>
      <span className="font-medium tabular-nums">
        <span aria-hidden="true">— mi</span>
        <span className="sr-only">Distance not yet calculated</span>
      </span>
      <Categories categories={card.categories} />
    </p>
  );
}

function registrationLink(registration: Registration): {
  href: string;
  label: string;
  leavesSite: boolean;
} {
  switch (registration.kind) {
    case RegistrationKind.Register:
      return { href: registration.url, label: "Register on the camp's site", leavesSite: true };
    case RegistrationKind.Call:
      return {
        href: `tel:${registration.phone}`,
        label: `Call ${registration.phone}`,
        leavesSite: false,
      };
    case RegistrationKind.Website:
      return { href: registration.url, label: "Camp's site", leavesSite: true };
  }
}

function RegistrationLink({ registration }: { registration: Registration }) {
  const link = registrationLink(registration);
  return (
    <a
      href={link.href}
      className="inline-flex min-h-touch items-center gap-1 text-ui font-semibold text-blueprint underline underline-offset-4"
    >
      {link.label}
      {link.leavesSite ? <ExternalLinkIcon /> : null}
    </a>
  );
}

/**
 * Whether a person checked these facts. "Verified" means we confirmed they were
 * accurate that day, nothing about the camp. A draft says it is not, and links
 * where it was read from when there is a page to link.
 */
function Provenance({ verification }: { verification: SessionCardView['verification'] }) {
  if (verification.kind === VerificationKind.Verified)
    return (
      <p aria-live="polite" className="text-caption text-ink-muted">
        Verified {formatVerifiedOn(verification.on)}
      </p>
    );
  if (verification.sourceUrl === undefined) return null;
  return (
    <p aria-live="polite" className="text-caption text-ink-muted">
      <a href={verification.sourceUrl} className="text-blueprint underline">
        Show Source Information
      </a>
    </p>
  );
}

/** Provenance first, then where to register. On a phone the link comes first and Verified last. */
function Footer({ card }: { card: SessionCardView }) {
  const hasProvenance =
    card.verification.kind === VerificationKind.Verified ||
    card.verification.sourceUrl !== undefined;
  if (!hasProvenance && card.registration === undefined) return null;
  return (
    <footer className="mt-1 flex flex-col-reverse gap-1 border-rule border-t pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <Provenance verification={card.verification} />
      {card.registration === undefined ? null : (
        <RegistrationLink registration={card.registration} />
      )}
    </footer>
  );
}

export function SessionCard({
  card,
  weekNumber,
  onApprove,
}: {
  card: SessionCardView;
  weekNumber: number;
  /** Present only for a reviewer: approves one record, resolving to what the database said. */
  onApprove?: OnApprove;
}) {
  const headingId = `${card.id}-name`;
  const item = useRef<HTMLLIElement>(null);
  return (
    <li
      ref={item}
      tabIndex={-1}
      aria-labelledby={headingId}
      className="flex overflow-hidden rounded-card border border-rule bg-surface"
    >
      <DateBlock card={card} weekNumber={weekNumber} />
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h3
            id={headingId}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-title text-ink"
          >
            {card.campName}
            {card.verification.kind === VerificationKind.Draft ? (
              <StatusPill isDraft label="Draft — not published" />
            ) : null}
          </h3>
          <Price priceCents={card.priceCents} />
        </div>
        <LocationLine card={card} />
        <Facts card={card} />
        {card.priceNote === undefined ? null : (
          <p className="text-caption text-ink-muted">{card.priceNote}</p>
        )}
        {card.registrationNotes === undefined ? null : (
          <p className="text-caption text-ink-muted">{card.registrationNotes}</p>
        )}
        {onApprove === undefined ? null : (
          <ApproveControls
            card={card}
            onApprove={onApprove}
            onApproved={() => item.current?.focus()}
          />
        )}
        <Footer card={card} />
      </div>
    </li>
  );
}
