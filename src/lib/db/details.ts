import type { CalendarDate } from '@campout/planner';

/**
 * The one typed reader of the catalog's `details` columns (CAM-27 decision 12,
 * ADR-0017 §5). The generated types say only `Json`, so nothing else in the
 * app touches a raw key.
 *
 * The database checks every write against the same vocabulary
 * (`camp_details_schema()` and its siblings in
 * `supabase/migrations/20260929000100_catalog_shape.sql`). Each reader below
 * mirrors one of those schemas, and the two change together. A value that has
 * drifted from the vocabulary throws rather than rendering as something it
 * isn't (AGENTS.md → Refuse rather than guess).
 *
 * Keys stay snake_case, as stored, like every other column in a row.
 */

export class DetailsError extends Error {
  override name = 'DetailsError';
}

export enum DiscountKind {
  EarlyRegistration = 'early_registration',
  Sibling = 'sibling',
  MultiWeek = 'multi_week',
  Member = 'member',
}

export enum MembershipPeriod {
  Month = 'month',
  Year = 'year',
}

export enum LunchProvision {
  Included = 'included',
  SoldSeparately = 'sold_separately',
  BringOwn = 'bring_own',
}

/** Whether a care fee is charged each day or once for the whole session. */
export enum FeePer {
  Day = 'day',
  Session = 'session',
}

export interface Discount {
  readonly kind: DiscountKind;
  /** Exactly one of amount_cents and percent_off. */
  readonly amount_cents?: number;
  readonly percent_off?: number;
  readonly deadline?: CalendarDate;
}

export interface Membership {
  readonly name: string;
  readonly price_cents?: number;
  readonly period?: MembershipPeriod;
}

export interface Lunch {
  readonly provision: LunchProvision;
  readonly price_cents?: number;
}

/** Our short summaries, never the camp's wording. At least one is present. */
export interface Policies {
  readonly cancellation?: string;
  readonly switching_weeks?: string;
  readonly payment?: string;
}

export interface CampDetails {
  /** Short tags: "swimming", "field games". */
  readonly activities?: readonly string[];
  readonly discounts?: readonly Discount[];
  readonly membership_required?: Membership;
  /** Our short summary of what a child must already be able to do. */
  readonly skill_required?: string;
  /** The camp's own eligibility phrasing, kept beside the converted grade (decision 5). */
  readonly eligibility_wording?: string;
  readonly lunch?: Lunch;
  readonly policies?: Policies;
  readonly financial_aid?: boolean;
  readonly registration_opens?: CalendarDate;
}

export interface FieldTrip {
  readonly destination: string;
  readonly min_grade?: number;
  readonly max_grade?: number;
}

/** A day spent away from the session's main location (decision 6). */
export interface OtherDay {
  readonly date: CalendarDate;
  /** The venue and its address, as the card shows it. */
  readonly location: string;
}

export interface SessionDetails {
  readonly field_trips?: readonly FieldTrip[];
  readonly other_days?: readonly OtherDay[];
}

export interface Fee {
  readonly price_cents: number;
  readonly per: FeePer;
}

/** At least one is present. */
export interface CareFees {
  readonly drop_off?: Fee;
  readonly pickup?: Fee;
}

export interface OptionDetails {
  /** A day rate for a longer session: SCOR's $90/day beside its $400 week (decision 2). */
  readonly daily_rate?: { readonly price_cents: number };
  readonly care_fees?: CareFees;
}

export function parseCampDetails(_value: unknown): CampDetails {
  throw new Error('not implemented');
}

export function parseSessionDetails(_value: unknown): SessionDetails {
  throw new Error('not implemented');
}

export function parseOptionDetails(_value: unknown): OptionDetails {
  throw new Error('not implemented');
}
