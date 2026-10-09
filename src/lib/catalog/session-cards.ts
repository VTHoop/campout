import { assertCalendarDate, type CalendarDate } from '@campout/planner';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';
import { richmondDate } from '../today';
import type { AgeRange, GradeRange, WallClockTime } from './types';
import { Category } from './types';

/**
 * The data-access service behind the session cards (CAM-32, CAM-28): the one
 * place the catalog is read for them. The page and the card see only
 * `SessionCardView`, never a database row. What a visitor may see is decided by
 * the database (RLS, ADR-0017 §2): this reads as the visitor and adds no status
 * filter and no reviewer logic of its own.
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
  readonly verification: Verification;
}

export enum VerificationKind {
  Verified = 'verified',
  Draft = 'draft',
}

/**
 * Whether a person has checked this session's facts. A verified session says
 * the day (in Richmond) they were checked; a draft says it is not, and links
 * the page it was read from when there is one. A card with neither cannot be
 * built, so nothing unverified can look verified.
 */
export type Verification =
  | { readonly kind: VerificationKind.Verified; readonly on: CalendarDate }
  | { readonly kind: VerificationKind.Draft; readonly sourceUrl?: string };

type Tables = Database['public']['Tables'];
type CampCategory = Database['public']['Enums']['camp_category'];

/** One session with everything its card reads, as the embedded select returns it. */
export interface SessionCardRow {
  readonly id: string;
  readonly start_date: string;
  readonly end_date: string;
  readonly status: Database['public']['Enums']['record_status'];
  readonly min_age: number | null;
  readonly max_age: number | null;
  readonly min_grade: number | null;
  readonly max_grade: number | null;
  readonly source_url: string | null;
  readonly verified_at: string | null;
  readonly camps: {
    readonly name: string;
    readonly categories: readonly CampCategory[];
    readonly registration_url: string | null;
    readonly registration_note: string | null;
    readonly providers: { readonly name: string; readonly website_url: string | null } | null;
  } | null;
  readonly locations: { readonly label: string; readonly city: string } | null;
  readonly session_options: readonly Pick<
    Tables['session_options']['Row'],
    'kind' | 'daily_start' | 'daily_end' | 'price_cents' | 'price_note'
  >[];
}

/** The database's category to ours. An exhaustive table, read through a Map. */
const CATEGORIES: ReadonlyMap<string, Category> = new Map(
  Object.entries({
    day_camp: Category.DayCamp,
    sports: Category.Sports,
    stem: Category.STEM,
    arts: Category.Arts,
    outdoors: Category.Outdoors,
    academic: Category.Academic,
    faith_based: Category.FaithBased,
  } satisfies Record<CampCategory, Category>),
);

type CardOption = SessionCardRow['session_options'][number];

/** The option a card shows: the full day when there is one, else the morning, else the afternoon. */
function optionToShow(options: readonly CardOption[]): CardOption | undefined {
  return (
    options.find((option) => option.kind === 'full_day') ??
    options.find((option) => option.kind === 'morning') ??
    options.find((option) => option.kind === 'afternoon')
  );
}

/** Refuse rather than guess: a row missing a parent the database should have returned is a bug. */
function present<T>(value: T | null, what: string, sessionId: string): T {
  if (value === null) throw new Error(`Session ${sessionId} came back with no ${what}`);
  return value;
}

function rangeOf(min: number | null, max: number | null): AgeRange | undefined {
  if (min === null && max === null) return undefined;
  return { ...(min === null ? {} : { min }), ...(max === null ? {} : { max }) };
}

function verificationOf(row: SessionCardRow): Verification {
  switch (row.status) {
    case 'verified':
      if (row.verified_at === null)
        throw new Error(`Session ${row.id} is verified but has no verified date`);
      return { kind: VerificationKind.Verified, on: richmondDate(new Date(row.verified_at)) };
    case 'draft':
      return {
        kind: VerificationKind.Draft,
        ...(row.source_url === null ? {} : { sourceUrl: row.source_url }),
      };
    case 'archived':
      throw new Error(`Session ${row.id} is archived; no card is built for it`);
  }
}

function registrationOf(
  camp: NonNullable<SessionCardRow['camps']>,
  websiteUrl: string | null,
): Registration | undefined {
  if (camp.registration_url !== null)
    return { kind: RegistrationKind.Register, url: camp.registration_url };
  if (websiteUrl !== null) return { kind: RegistrationKind.Website, url: websiteUrl };
  return undefined;
}

function cardFromRow(row: SessionCardRow): SessionCardView {
  const camp = present(row.camps, 'camp', row.id);
  const provider = present(camp.providers, 'provider', row.id);
  const location = present(row.locations, 'location', row.id);
  const option = optionToShow(row.session_options);
  const ageRange = rangeOf(row.min_age, row.max_age);
  const gradeRange = rangeOf(row.min_grade, row.max_grade);
  const registration = registrationOf(camp, provider.website_url);

  return {
    id: row.id,
    campName: camp.name,
    providerName: provider.name,
    locationName: location.label,
    city: location.city,
    startDate: assertCalendarDate(row.start_date, `Session ${row.id} start date`),
    endDate: assertCalendarDate(row.end_date, `Session ${row.id} end date`),
    ...(option?.daily_start == null ? {} : { startTime: option.daily_start }),
    ...(option?.daily_end == null ? {} : { endTime: option.daily_end }),
    ...(option?.price_cents == null ? {} : { priceCents: option.price_cents }),
    ...(option?.price_note == null ? {} : { priceNote: option.price_note }),
    ...(ageRange === undefined ? {} : { ageRange }),
    ...(gradeRange === undefined ? {} : { gradeRange }),
    categories: camp.categories.map((category) => {
      const known = CATEGORIES.get(category);
      if (known === undefined)
        throw new Error(`Session ${row.id} has unknown category ${category}`);
      return known;
    }),
    ...(registration === undefined ? {} : { registration }),
    ...(camp.registration_note === null ? {} : { registrationNotes: camp.registration_note }),
    verification: verificationOf(row),
  };
}

/** One card per row, in the order given. Throws on any row the database could not have produced. */
export function sessionCardsFromRows(rows: readonly SessionCardRow[]): readonly SessionCardView[] {
  return rows.map(cardFromRow);
}

const SESSION_CARD_SELECT = `
  id, start_date, end_date, status, min_age, max_age, min_grade, max_grade,
  source_url, verified_at,
  camps ( name, categories, registration_url, registration_note,
          providers ( name, website_url ) ),
  locations ( label, city ),
  session_options ( kind, daily_start, daily_end, price_cents, price_note )
`;

/** Every session the visitor may see, as cards. Who that is, is the database's decision. */
export async function listSessionCards(
  client: SupabaseClient<Database>,
): Promise<readonly SessionCardView[]> {
  const { data, error } = await client
    .from('sessions')
    .select(SESSION_CARD_SELECT)
    .order('start_date')
    .order('id');
  if (error) throw new Error(`Could not read sessions: ${error.message}`);
  return sessionCardsFromRows(data);
}
