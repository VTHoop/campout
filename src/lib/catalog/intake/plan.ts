import type { CampDetails, OptionDetails, SessionDetails } from '@/lib/db/details';
import type { Json, TablesInsert } from '@/lib/db/types';

/**
 * The intake plan (CAM-47): what one run of the camp-intake skill drafts and
 * corrects, as the owner confirmed it at the run's one checkpoint. The skill
 * writes it; `scripts/camp-intake.ts` previews it and, on `--yes`, writes it.
 *
 * It holds facts only, never status: no type here has a field for `status`,
 * `verified_at` or `verified_by`, so a plan cannot ask to publish anything.
 * The database's constraints are the only check on the facts themselves.
 */

/** Where a record's facts came from: the exact page, or a document stored in `camp-sources`. */
export type Evidence = { readonly url: string } | { readonly documentPath: string };

/** Columns a run never writes: ids, provenance, status and what Postgres maintains. */
type Managed =
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'source_url'
  | 'source_document_path'
  | 'status'
  | 'verified_at'
  | 'verified_by';

export type ProviderFacts = Omit<TablesInsert<'providers'>, Managed>;
export type CampFacts = Omit<TablesInsert<'camps'>, Managed | 'provider_id' | 'details'> & {
  readonly details?: CampDetails;
};
export type LocationFacts = Omit<TablesInsert<'locations'>, Managed | 'point' | 'address_key'>;
export type SessionFacts = Omit<
  TablesInsert<'sessions'>,
  Managed | 'camp_id' | 'location_id' | 'details'
> & { readonly details?: SessionDetails };
export type OptionFacts = Omit<
  TablesInsert<'session_options'>,
  Managed | 'session_id' | 'details'
> & {
  readonly details?: OptionDetails;
};

/** Degrees, WGS 84. Supplied by the owner at the checkpoint: there is no geocoder. */
export interface Coordinates {
  readonly lat: number;
  readonly long: number;
}

/** A record the owner confirmed is one we already hold. Its children go under it. */
export interface Existing {
  readonly ref: string;
  readonly existing: string;
}

/** A record to draft. `distinctFrom` lists the proposed matches the owner said are not it. */
export interface New<Facts> {
  readonly ref: string;
  readonly source: Evidence;
  readonly facts: Facts;
  readonly distinctFrom?: readonly string[];
}

export type PlannedProvider = Existing | New<ProviderFacts>;
/** `coordinates` is null when the owner has not supplied them; the database then refuses the row. */
export type PlannedLocation =
  | Existing
  | (New<LocationFacts> & { readonly coordinates: Coordinates | null });
export type PlannedCamp = Existing | (New<CampFacts> & { readonly providerRef: string });

/** Sessions are always new: a correction to one we hold is an update. */
export interface PlannedSession {
  readonly ref: string;
  readonly campRef: string;
  readonly locationRef: string;
  readonly source: Evidence;
  readonly facts: SessionFacts;
  readonly options: readonly OptionFacts[];
}

/** The records a run drafts or corrects: the four a card approves, and a session's option. */
export enum IntakeKind {
  Provider = 'provider',
  Camp = 'camp',
  Location = 'location',
  Session = 'session',
  Option = 'session_option',
}

/**
 * A correction to a record we hold. `proposed` is what the source says, field
 * by field; `approved` names the fields the owner said yes to. Only those are
 * written, and only where they still differ.
 */
export interface PlannedUpdate {
  readonly kind: IntakeKind;
  readonly id: string;
  readonly sourceUrl: string;
  readonly proposed: Readonly<Record<string, unknown>>;
  readonly approved: readonly string[];
}

/**
 * A document to store in `camp-sources` under `path`, before any row cites it.
 * The plan carries its bytes, base64, so the script that runs it reads no file
 * by a path it was handed.
 */
export interface SourceDocument {
  readonly path: string;
  readonly base64: string;
}

/** Something the run did not draft, and why: a session missing a required fact, say. */
export interface Skip {
  readonly what: string;
  readonly reason: string;
}

/** A fact the source left open and the owner could not answer, so it stays blank. */
export interface Blank {
  readonly record: string;
  readonly field: string;
  readonly question: string;
}

export interface IntakePlan {
  readonly documents?: readonly SourceDocument[];
  readonly providers: readonly PlannedProvider[];
  readonly locations: readonly PlannedLocation[];
  readonly camps: readonly PlannedCamp[];
  readonly sessions: readonly PlannedSession[];
  readonly updates: readonly PlannedUpdate[];
  readonly skipped: readonly Skip[];
  readonly blanks: readonly Blank[];
}

export function isExisting(record: Existing | New<unknown>): record is Existing {
  return 'existing' in record;
}

export function isNew<T extends Existing | New<unknown>>(
  record: T,
): record is Exclude<T, Existing> {
  return !isExisting(record);
}

/** The evidence columns for a row: exactly one of the two is set. */
export function evidenceColumns(source: Evidence): {
  source_url: string | null;
  source_document_path: string | null;
} {
  return 'url' in source
    ? { source_url: source.url, source_document_path: null }
    : { source_url: null, source_document_path: source.documentPath };
}

/** `details` as the column takes it: a plain JSON value, or absent so the column default stands. */
function detailsColumn(details: object | undefined): Json | undefined {
  return details === undefined ? undefined : JSON.parse(JSON.stringify(details));
}

export function providerRow(provider: New<ProviderFacts>): TablesInsert<'providers'> {
  return { ...provider.facts, ...evidenceColumns(provider.source) };
}

/** EWKT, longitude first, as PostGIS reads it. A null point is the database's to refuse. */
function pointOf(coordinates: Coordinates | null): string | null {
  return coordinates === null ? null : `SRID=4326;POINT(${coordinates.long} ${coordinates.lat})`;
}

export function locationRow(
  location: New<LocationFacts> & { readonly coordinates: Coordinates | null },
): TablesInsert<'locations'> {
  return {
    ...location.facts,
    point: pointOf(location.coordinates),
    ...evidenceColumns(location.source),
  };
}

export function campRow(camp: New<CampFacts>, providerId: string): TablesInsert<'camps'> {
  const { details, ...facts } = camp.facts;
  return {
    ...facts,
    provider_id: providerId,
    details: detailsColumn(details),
    ...evidenceColumns(camp.source),
  };
}

export function sessionRow(
  session: PlannedSession,
  campId: string,
  locationId: string,
): TablesInsert<'sessions'> {
  const { details, ...facts } = session.facts;
  return {
    ...facts,
    camp_id: campId,
    location_id: locationId,
    details: detailsColumn(details),
    ...evidenceColumns(session.source),
  };
}

export function optionRows(
  session: PlannedSession,
  sessionId: string,
): readonly TablesInsert<'session_options'>[] {
  return session.options.map(({ details, ...facts }) => ({
    session_id: sessionId,
    ...facts,
    details: detailsColumn(details),
  }));
}

/**
 * The location match key, as `locations.address_key` derives it in Postgres
 * (`20260929000100_catalog_shape.sql`): street and postal code, lower-cased,
 * every run of other characters one space. A mirror, so a test holds it to
 * the database's own value.
 */
export function addressKey(street: string, postalCode: string): string {
  return `${street} ${postalCode}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
