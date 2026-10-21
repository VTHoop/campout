import { Category } from '../types';
import type {
  CampFacts,
  Coordinates,
  Evidence,
  IntakePlan,
  LocationFacts,
  New,
  PlannedSession,
  ProviderFacts,
} from './plan';

/**
 * Invented intake plans for the unit and RLS suites (CAM-47): never a real
 * camp. Each builder takes a `marker` folded into every name, so an RLS test
 * can find and remove exactly the rows it wrote, and overrides for the one
 * fact a test is about.
 */

export const PAGE = { url: 'https://example.test/intake/camps' } as const satisfies Evidence;
export const COORDINATES: Coordinates = { lat: 37.5407, long: -77.436 };

export function providerPlan(
  marker: string,
  overrides: Partial<New<ProviderFacts>> = {},
): New<ProviderFacts> {
  return {
    ref: 'provider',
    source: PAGE,
    facts: { name: `Intake League ${marker}`, website_url: 'https://example.test' },
    ...overrides,
  };
}

export function locationPlan(
  marker: string,
  overrides: Partial<New<LocationFacts> & { coordinates: Coordinates | null }> = {},
): New<LocationFacts> & { readonly coordinates: Coordinates | null } {
  return {
    ref: 'location',
    source: PAGE,
    facts: {
      label: `Intake Center ${marker}`,
      street: `100 ${marker} Way`,
      city: 'Richmond',
      state: 'VA',
      postal_code: '23220',
    },
    coordinates: COORDINATES,
    ...overrides,
  };
}

export function campPlan(
  marker: string,
  overrides: Partial<New<CampFacts> & { providerRef: string }> = {},
): New<CampFacts> & { readonly providerRef: string } {
  return {
    ref: 'camp',
    providerRef: 'provider',
    source: PAGE,
    facts: {
      name: `Intake Day Camp ${marker}`,
      categories: [Category.DayCamp],
      registration_url: 'https://example.test/intake/register',
    },
    ...overrides,
  };
}

export function sessionPlan(overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    ref: 'session',
    campRef: 'camp',
    locationRef: 'location',
    source: PAGE,
    facts: { start_date: '2027-07-12', end_date: '2027-07-16' },
    options: [{ kind: 'full_day', price_cents: 32500 }],
    ...overrides,
  };
}

/** A plan with nothing in it but what `parts` says. */
export function planOf(parts: Partial<IntakePlan>): IntakePlan {
  return {
    providers: [],
    locations: [],
    camps: [],
    sessions: [],
    updates: [],
    skipped: [],
    blanks: [],
    ...parts,
  };
}

/** One new provider, location, camp and session with one option. */
export function wholePlan(marker: string): IntakePlan {
  return planOf({
    providers: [providerPlan(marker)],
    locations: [locationPlan(marker)],
    camps: [campPlan(marker)],
    sessions: [sessionPlan()],
  });
}
