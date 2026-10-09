import type { Database } from '@/lib/db/types';
import type { Camp, Location, Provider, Session, Source } from '../types';
import { Category } from '../types';
import type { CatalogSnapshot } from '../validateCatalog';

/**
 * The one-time import's mapping (CAM-28): the TypeScript mock's shape in, the
 * draft rows ADR-0017 and ADR-0018 settled out. Pure. The script that writes
 * them lives in `scripts/import-catalog.ts`.
 *
 * The database assigns every id, so rows link by `ref`, the mock's own id,
 * and the script resolves each ref to a uuid as it inserts in dependency order.
 */

type Tables = Database['public']['Tables'];

export interface DraftProvider {
  readonly ref: string;
  readonly row: Tables['providers']['Insert'];
}

export interface DraftLocation {
  readonly ref: string;
  readonly row: Tables['locations']['Insert'];
}

export interface DraftCamp {
  readonly ref: string;
  readonly providerRef: string;
  readonly row: Omit<Tables['camps']['Insert'], 'provider_id'>;
}

export interface DraftSession {
  readonly ref: string;
  readonly campRef: string;
  readonly locationRef: string;
  readonly row: Omit<Tables['sessions']['Insert'], 'camp_id' | 'location_id'>;
}

export interface DraftOption {
  readonly sessionRef: string;
  readonly row: Omit<Tables['session_options']['Insert'], 'session_id'>;
}

export interface DraftCatalog {
  readonly providers: readonly DraftProvider[];
  readonly locations: readonly DraftLocation[];
  readonly camps: readonly DraftCamp[];
  readonly sessions: readonly DraftSession[];
  readonly options: readonly DraftOption[];
}

type CampCategory = Database['public']['Enums']['camp_category'];
type OptionKind = Database['public']['Enums']['session_option_kind'];

/** Our enum to the database's. An exhaustive table, read through a Map. */
const DB_CATEGORIES: ReadonlyMap<Category, CampCategory> = new Map(
  Object.entries({
    [Category.Sports]: 'sports',
    [Category.STEM]: 'stem',
    [Category.Arts]: 'arts',
    [Category.Outdoors]: 'outdoors',
    [Category.Academic]: 'academic',
    [Category.FaithBased]: 'faith_based',
  } satisfies Record<Category, CampCategory>) as [Category, CampCategory][],
);

/** A half-day option ends by this time, or starts at or after the next. */
const MORNING_ENDS_BY = '13:00';
const AFTERNOON_STARTS_AT = '12:00';

function byId<T extends { readonly id: string }>(rows: readonly T[]): ReadonlyMap<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

/** Refuse rather than guess: a dangling reference is a bug in the catalog. */
function lookup<T>(rows: ReadonlyMap<string, T>, id: string, what: string): T {
  const row = rows.get(id);
  if (row === undefined) throw new Error(`Catalog has no ${what} "${id}"`);
  return row;
}

function sourceColumns(source: Source): { source_url: string } | { source_document_path: string } {
  return source.url === undefined
    ? { source_document_path: source.documentPath }
    : { source_url: source.url };
}

/** The provider whose first session uses each location: the owner of its evidence. */
function providerByLocation(catalog: CatalogSnapshot): ReadonlyMap<string, Provider> {
  const camps = byId(catalog.camps);
  const providers = byId(catalog.providers);
  const owners = new Map<string, Provider>();
  for (const session of catalog.sessions) {
    if (owners.has(session.locationId)) continue;
    const camp = lookup(camps, session.campId, 'camp');
    owners.set(session.locationId, lookup(providers, camp.providerId, 'provider'));
  }
  return owners;
}

/** URLs that point at a camp's own sign-up or home, which are not where its facts came from. */
function notEvidence(provider: Provider, camps: readonly Camp[]): ReadonlySet<string | undefined> {
  const registrations = camps
    .filter((camp) => camp.providerId === provider.id)
    .map((camp) => camp.registrationInfo?.url);
  return new Set([provider.website, ...registrations]);
}

function providerGaps(provider: Provider, camps: readonly Camp[]): string[] {
  const label = `Provider "${provider.name}"`;
  if (provider.source === undefined) return [`${label}: no source`];
  if (notEvidence(provider, camps).has(provider.source.url))
    return [
      `${label}: source is the provider website or a registration link, not the page the facts came from`,
    ];
  return [];
}

function locationGaps(location: Location, owners: ReadonlyMap<string, Provider>): string[] {
  const label = `Location "${location.name}"`;
  const gaps: string[] = [];
  if (location.lat === undefined || location.long === undefined)
    gaps.push(`${label}: no coordinates`);
  if (location.postalCode === undefined) gaps.push(`${label}: no postal code`);
  if (!owners.has(location.id)) gaps.push(`${label}: no session uses it, so it has no source`);
  return gaps;
}

/** What stops a record being imported, one line each. Empty means ready. */
export function findImportGaps(catalog: CatalogSnapshot): string[] {
  const owners = providerByLocation(catalog);
  return [
    ...catalog.providers.flatMap((provider) => providerGaps(provider, catalog.camps)),
    ...catalog.locations.flatMap((location) => locationGaps(location, owners)),
  ];
}

function providerDraft(provider: Provider): DraftProvider {
  return {
    ref: provider.id,
    row: {
      name: provider.name,
      ...(provider.website === undefined ? {} : { website_url: provider.website }),
      ...(provider.source === undefined ? {} : sourceColumns(provider.source)),
    },
  };
}

function locationDraft(location: Location, owner: Provider): DraftLocation {
  return {
    ref: location.id,
    row: {
      label: location.name,
      street: location.address,
      city: location.city,
      state: location.state,
      postal_code: location.postalCode ?? '',
      point: `SRID=4326;POINT(${location.long} ${location.lat})`,
      ...(owner.source === undefined ? {} : sourceColumns(owner.source)),
    },
  };
}

function registrationNote(camp: Camp): string | undefined {
  const info = camp.registrationInfo;
  const parts = [info?.phone === undefined ? undefined : `Call ${info.phone}.`, info?.notes];
  const note = parts.filter((part) => part !== undefined).join(' ');
  return note === '' ? undefined : note;
}

function campDraft(camp: Camp, owner: Provider): DraftCamp {
  const note = registrationNote(camp);
  const url = camp.registrationInfo?.url;
  return {
    ref: camp.id,
    providerRef: camp.providerId,
    row: {
      name: camp.name,
      summary: camp.description,
      categories: camp.categories.map((category) => lookup(DB_CATEGORIES, category, 'category')),
      ...(url === undefined ? {} : { registration_url: url }),
      ...(note === undefined ? {} : { registration_note: note }),
      ...(owner.source === undefined ? {} : sourceColumns(owner.source)),
    },
  };
}

function sessionDraft(session: Session, owner: Provider): DraftSession {
  const { ageRange, gradeRange } = session;
  return {
    ref: session.id,
    campRef: session.campId,
    locationRef: session.locationId,
    row: {
      start_date: session.startDate,
      end_date: session.endDate,
      ...(ageRange?.min === undefined ? {} : { min_age: ageRange.min }),
      ...(ageRange?.max === undefined ? {} : { max_age: ageRange.max }),
      ...(gradeRange?.min === undefined ? {} : { min_grade: gradeRange.min }),
      ...(gradeRange?.max === undefined ? {} : { max_grade: gradeRange.max }),
      ...(owner.source === undefined ? {} : sourceColumns(owner.source)),
    },
  };
}

/** The mock holds one time per session; which slot it is follows from the hours. */
function optionKind({ startTime, endTime }: Session): OptionKind {
  if (startTime === undefined || endTime === undefined) return 'full_day';
  if (endTime <= MORNING_ENDS_BY) return 'morning';
  if (startTime >= AFTERNOON_STARTS_AT) return 'afternoon';
  return 'full_day';
}

function optionDraft(session: Session): DraftOption {
  return {
    sessionRef: session.id,
    row: {
      kind: optionKind(session),
      ...(session.startTime === undefined ? {} : { daily_start: session.startTime }),
      ...(session.endTime === undefined ? {} : { daily_end: session.endTime }),
      ...(session.priceCents === undefined ? {} : { price_cents: session.priceCents }),
      ...(session.priceNote === undefined ? {} : { price_note: session.priceNote }),
    },
  };
}

/** Drafts for every record. Throws, listing every gap, if any record is not ready. */
export function mapCatalogToDrafts(catalog: CatalogSnapshot): DraftCatalog {
  const gaps = findImportGaps(catalog);
  if (gaps.length > 0) throw new Error(gaps.join('\n'));

  const camps = byId(catalog.camps);
  const providers = byId(catalog.providers);
  const owners = providerByLocation(catalog);
  const ownerOfCamp = (campId: string) =>
    lookup(providers, lookup(camps, campId, 'camp').providerId, 'provider');

  return {
    providers: catalog.providers.map(providerDraft),
    locations: catalog.locations.map((location) =>
      locationDraft(location, lookup(owners, location.id, 'location owner')),
    ),
    camps: catalog.camps.map((camp) =>
      campDraft(camp, lookup(providers, camp.providerId, 'provider')),
    ),
    sessions: catalog.sessions.map((session) => sessionDraft(session, ownerOfCamp(session.campId))),
    options: catalog.sessions.map(optionDraft),
  };
}
