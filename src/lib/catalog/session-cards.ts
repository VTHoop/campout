import type { CalendarDate } from '@campout/planner';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';
import type { AgeRange, Category, GradeRange, WallClockTime } from './types';

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
    readonly categories: readonly Category[];
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

/** One card per row, in the order given. Throws on any row the database could not have produced. */
export function sessionCardsFromRows(_rows: readonly SessionCardRow[]): readonly SessionCardView[] {
  throw new Error('not implemented');
}

/** Every session the visitor may see, as cards. Who that is, is the database's decision. */
export function listSessionCards(
  _client: SupabaseClient<Database>,
): Promise<readonly SessionCardView[]> {
  return Promise.reject(new Error('not implemented'));
}
