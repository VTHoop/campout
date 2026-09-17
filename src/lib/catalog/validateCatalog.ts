import { assertCalendarDate, compareDates } from '@campout/planner';
import type { Camp, Location, Provider, Session } from './types';
import { Category } from './types';

/**
 * A snapshot of the catalog to check for internal consistency — the real
 * seed data on its way to Postgres, or a small fixture built for one test.
 * Both must hold the same structural invariants.
 */
export interface CatalogSnapshot {
  readonly providers: readonly Provider[];
  readonly locations: readonly Location[];
  readonly camps: readonly Camp[];
  readonly sessions: readonly Session[];
}

/**
 * Structural invariants any catalog snapshot must hold: every reference
 * resolves, every date is real with the end on or after the start, no
 * session is priced negative or fractional, and every camp has at least one
 * valid category.
 *
 * Returns the list of violations rather than throwing on the first one, so a
 * broken snapshot — real data or a fixture — shows everything wrong with it
 * in a single run instead of one failure at a time.
 */
export function findCatalogInconsistencies(snapshot: CatalogSnapshot): string[] {
  const providerIds = new Set(snapshot.providers.map((provider) => provider.id));
  const locationIds = new Set(snapshot.locations.map((location) => location.id));
  const campIds = new Set(snapshot.camps.map((camp) => camp.id));

  return [
    ...snapshot.camps.flatMap((camp) => findCampIssues(camp, providerIds)),
    ...snapshot.sessions.flatMap((session) => findSessionIssues(session, campIds, locationIds)),
  ];
}

function findCampIssues(camp: Camp, providerIds: ReadonlySet<string>): string[] {
  const issues: string[] = [];
  if (!providerIds.has(camp.providerId)) {
    issues.push(`camp ${camp.id} references a provider that doesn't exist: ${camp.providerId}`);
  }
  if (camp.categories.length === 0) {
    issues.push(`camp ${camp.id} has no categories`);
  }
  for (const category of camp.categories) {
    if (!Object.values(Category).includes(category)) {
      issues.push(`camp ${camp.id} has an invalid category: ${category}`);
    }
  }
  return issues;
}

function findSessionIssues(
  session: Session,
  campIds: ReadonlySet<string>,
  locationIds: ReadonlySet<string>,
): string[] {
  const issues: string[] = [];
  if (!campIds.has(session.campId)) {
    issues.push(`session ${session.id} references a camp that doesn't exist: ${session.campId}`);
  }
  if (!locationIds.has(session.locationId)) {
    issues.push(
      `session ${session.id} references a location that doesn't exist: ${session.locationId}`,
    );
  }
  issues.push(...findDateIssues(session));
  if (hasInvalidPrice(session)) {
    issues.push(`session ${session.id} has an invalid priceCents: ${session.priceCents}`);
  }
  return issues;
}

function hasInvalidPrice(session: Session): boolean {
  if (session.priceCents === undefined) {
    return false;
  }
  return !Number.isInteger(session.priceCents) || session.priceCents < 0;
}

function findDateIssues(session: Session): string[] {
  const issues: string[] = [];
  const start = parseCalendarDate(session.id, session.startDate, 'startDate', issues);
  const end = parseCalendarDate(session.id, session.endDate, 'endDate', issues);

  if (endsBeforeItStarts(start, end)) {
    issues.push(`session ${session.id} ends (${end}) before it starts (${start})`);
  }
  return issues;
}

function endsBeforeItStarts(start: string | undefined, end: string | undefined): boolean {
  if (start === undefined || end === undefined) {
    return false;
  }
  return compareDates(end, start) < 0;
}

function parseCalendarDate(
  sessionId: string,
  value: string,
  field: string,
  issues: string[],
): string | undefined {
  try {
    return assertCalendarDate(value, `${sessionId}.${field}`);
  } catch (error) {
    issues.push(`session ${sessionId}: ${(error as Error).message}`);
    return undefined;
  }
}
