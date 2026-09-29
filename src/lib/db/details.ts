import type { CalendarDate } from '@campout/planner';
import { assertCalendarDate } from '@campout/planner';

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

type Reader<T> = (value: unknown, path: string) => T;
type Shape = Readonly<Record<string, Reader<unknown>>>;
type Read<S extends Shape> = { readonly [K in keyof S]: ReturnType<S[K]> };

function fail(path: string, problem: string): never {
  throw new DetailsError(`${path}: ${problem}`);
}

function text(maxLength: number): Reader<string> {
  return (value, path) =>
    typeof value === 'string' && value.length > 0 && value.length <= maxLength
      ? value
      : fail(path, `expected text of 1–${maxLength} characters`);
}

function wholeNumber(min: number, max: number): Reader<number> {
  return (value, path) =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
      ? value
      : fail(path, `expected a whole number from ${min} to ${max}`);
}

const cents = wholeNumber(0, Number.MAX_SAFE_INTEGER);
/** -1 is pre-K and 0 kindergarten, as on sessions.min_grade. */
const grade = wholeNumber(-1, 12);

const yesNo: Reader<boolean> = (value, path) =>
  typeof value === 'boolean' ? value : fail(path, 'expected true or false');

function oneOf<T extends string>(values: readonly T[]): Reader<T> {
  return (value, path) =>
    values.find((allowed) => allowed === value) ??
    fail(path, `expected one of ${values.join(', ')}`);
}

const calendarDate: Reader<CalendarDate> = (value, path) => {
  if (typeof value !== 'string') return fail(path, 'expected a YYYY-MM-DD date');
  try {
    return assertCalendarDate(value, path);
  } catch (error) {
    return fail(path, (error as Error).message);
  }
};

function listOf<T>(item: Reader<T>): Reader<readonly T[]> {
  return (value, path) =>
    Array.isArray(value)
      ? value.map((entry, index) => item(entry, `${path}[${index}]`))
      : fail(path, 'expected a list');
}

function entriesOf(value: unknown, path: string): [string, unknown][] {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.entries(value)
    : fail(path, 'expected an object');
}

/**
 * An object with `required` and `optional` keys and no others — the JSON
 * schema's `required` plus `additionalProperties: false`.
 */
function record<R extends Shape, O extends Shape>(
  required: R,
  optional: O,
): Reader<Read<R> & Partial<Read<O>>> {
  const readers = new Map([...Object.entries(required), ...Object.entries(optional)]);

  return (value, path) => {
    const entries = entriesOf(value, path);
    const present = new Set(entries.map(([key]) => key));
    const missing = Object.keys(required).find((key) => !present.has(key));
    if (missing !== undefined) fail(`${path}.${missing}`, 'required');

    const parsed = entries.map(([key, raw]) => {
      const read = readers.get(key) ?? fail(`${path}.${key}`, 'not in the details vocabulary');
      return [key, read(raw, `${path}.${key}`)];
    });
    return Object.fromEntries(parsed) as Read<R> & Partial<Read<O>>;
  };
}

function refine<T>(read: Reader<T>, holds: (value: T) => boolean, problem: string): Reader<T> {
  return (value, path) => {
    const parsed = read(value, path);
    return holds(parsed) ? parsed : fail(path, problem);
  };
}

/** The JSON schema's `minProperties: 1`: a group with nothing in it is a mistake. */
function nonEmpty<T extends object>(read: Reader<T>): Reader<T> {
  return refine(read, (value) => Object.keys(value).length > 0, 'expected at least one entry');
}

// ------------------------------------------------------------------- camps

const discount: Reader<Discount> = refine(
  record(
    { kind: oneOf(Object.values(DiscountKind)) },
    { amount_cents: cents, percent_off: wholeNumber(1, 100), deadline: calendarDate },
  ),
  (value) => (value.amount_cents === undefined) !== (value.percent_off === undefined),
  'expected an amount or a percentage, not both',
);

const readCampDetails: Reader<CampDetails> = record(
  {},
  {
    activities: listOf(text(40)),
    discounts: listOf(discount),
    membership_required: record(
      { name: text(100) },
      { price_cents: cents, period: oneOf(Object.values(MembershipPeriod)) },
    ),
    skill_required: text(200),
    eligibility_wording: text(200),
    lunch: record({ provision: oneOf(Object.values(LunchProvision)) }, { price_cents: cents }),
    policies: nonEmpty(
      record({}, { cancellation: text(300), switching_weeks: text(300), payment: text(300) }),
    ),
    financial_aid: yesNo,
    registration_opens: calendarDate,
  },
);

// ---------------------------------------------------------------- sessions

const readSessionDetails: Reader<SessionDetails> = record(
  {},
  {
    field_trips: listOf(record({ destination: text(100) }, { min_grade: grade, max_grade: grade })),
    other_days: listOf(record({ date: calendarDate, location: text(200) }, {})),
  },
);

// ----------------------------------------------------------------- options

const fee: Reader<Fee> = record({ price_cents: cents, per: oneOf(Object.values(FeePer)) }, {});

const readOptionDetails: Reader<OptionDetails> = record(
  {},
  {
    daily_rate: record({ price_cents: cents }, {}),
    care_fees: nonEmpty(record({}, { drop_off: fee, pickup: fee })),
  },
);

export function parseCampDetails(value: unknown): CampDetails {
  return readCampDetails(value, 'details');
}

export function parseSessionDetails(value: unknown): SessionDetails {
  return readSessionDetails(value, 'details');
}

export function parseOptionDetails(value: unknown): OptionDetails {
  return readOptionDetails(value, 'details');
}
