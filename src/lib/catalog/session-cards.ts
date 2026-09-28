import type { CalendarDate } from '@campout/planner';
import { mockCamps, mockLocations, mockProviders, mockSessions } from './mock-data';
import type {
  AgeRange,
  Camp,
  Category,
  GradeRange,
  Location,
  Provider,
  Session,
  WallClockTime,
} from './types';

/**
 * The data-access service behind the session cards (CAM-32): the one place the
 * catalog is read for them. The page and the card see only `SessionCardView`,
 * never the mock data, so CAM-28 can switch this to Supabase without touching
 * either. Async for the same reason: the database read will be.
 */

/** Which way the card sends a parent to register, in order of preference. */
export enum RegistrationKind {
  Register = 'register',
  Call = 'call',
  Website = 'website',
}

export type Registration =
  | { readonly kind: RegistrationKind.Register; readonly url: string }
  | { readonly kind: RegistrationKind.Call; readonly phone: string }
  | { readonly kind: RegistrationKind.Website; readonly url: string };

/** Everything one session card shows, joined from its camp, provider and location. */
export interface SessionCardView {
  readonly id: string;
  readonly campName: string;
  readonly providerName: string;
  readonly locationName: string;
  readonly city: string;
  readonly startDate: CalendarDate;
  readonly endDate: CalendarDate;
  readonly startTime?: WallClockTime;
  readonly endTime?: WallClockTime;
  readonly priceCents?: number;
  readonly priceNote?: string;
  readonly ageRange?: AgeRange;
  readonly gradeRange?: GradeRange;
  readonly categories: readonly Category[];
  readonly registration?: Registration;
  readonly registrationNotes?: string;
}

export interface Catalog {
  readonly providers: readonly Provider[];
  readonly locations: readonly Location[];
  readonly camps: readonly Camp[];
  readonly sessions: readonly Session[];
}

function byId<T extends { readonly id: string }>(rows: readonly T[]): ReadonlyMap<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

/** Refuse rather than guess (AGENTS.md → Code conventions): a dangling reference is a bug. */
function lookup<T>(rows: ReadonlyMap<string, T>, id: string, what: string): T {
  const row = rows.get(id);
  if (row === undefined) throw new Error(`Catalog has no ${what} "${id}"`);
  return row;
}

/** The camp's registration URL, else its phone number, else the provider's website. */
function registrationFor(camp: Camp, provider: Provider): Registration | undefined {
  const info = camp.registrationInfo;
  if (info?.url !== undefined) return { kind: RegistrationKind.Register, url: info.url };
  if (info?.phone !== undefined) return { kind: RegistrationKind.Call, phone: info.phone };
  if (provider.website !== undefined)
    return { kind: RegistrationKind.Website, url: provider.website };
  return undefined;
}

/** One card per session, in catalog order. Throws on any reference the catalog cannot resolve. */
export function sessionCardsFrom(catalog: Catalog): readonly SessionCardView[] {
  const camps = byId(catalog.camps);
  const providers = byId(catalog.providers);
  const locations = byId(catalog.locations);

  return catalog.sessions.map((session) => {
    const camp = lookup(camps, session.campId, 'camp');
    const provider = lookup(providers, camp.providerId, 'provider');
    const location = lookup(locations, session.locationId, 'location');
    return {
      id: session.id,
      campName: camp.name,
      providerName: provider.name,
      locationName: location.name,
      city: location.city,
      startDate: session.startDate,
      endDate: session.endDate,
      startTime: session.startTime,
      endTime: session.endTime,
      priceCents: session.priceCents,
      priceNote: session.priceNote,
      ageRange: session.ageRange,
      gradeRange: session.gradeRange,
      categories: camp.categories,
      registration: registrationFor(camp, provider),
      registrationNotes: camp.registrationInfo?.notes,
    };
  });
}

const MOCK_CATALOG: Catalog = {
  providers: mockProviders,
  locations: mockLocations,
  camps: mockCamps,
  sessions: mockSessions,
};

/** Every session in the catalog, as cards. */
export function listSessionCards(): Promise<readonly SessionCardView[]> {
  return Promise.resolve(sessionCardsFrom(MOCK_CATALOG));
}
