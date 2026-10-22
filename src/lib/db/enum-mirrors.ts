import type { CalendarType, ClosureTag, SchoolDistrict } from '@campout/planner';
import type { IntakeKind } from '@/lib/catalog/intake/plan';
import type { Category, RecordKind } from '@/lib/catalog/types';
import type { Database } from './types';

/**
 * Compile-time locks between the planner's enums and the database domains they
 * mirror (AGENTS.md → One layer owns a domain). The database owns each set;
 * the planner can't import generated types, so the lock lives here. Adding,
 * removing or renaming a value on either side without the other fails
 * `pnpm typecheck`.
 *
 * Types only: nothing here exists at runtime.
 */

type Enums = Database['public']['Enums'];

/** `true` only when A and B are the same set of strings. */
type SameSet<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Locked<T extends true> = T;

export type SchoolDistrictLocked = Locked<SameSet<`${SchoolDistrict}`, Enums['school_district']>>;
export type CalendarTypeLocked = Locked<SameSet<`${CalendarType}`, Enums['calendar_type']>>;
export type ClosureTagLocked = Locked<SameSet<`${ClosureTag}`, Enums['closure_tag']>>;
/**
 * The card's `RecordKind` is four of the database's seven `catalog_record_kind`
 * values, so the lock is a subset: a renamed or removed value fails here.
 */
export type RecordKindLocked = Locked<
  [`${RecordKind}`] extends [Enums['catalog_record_kind']] ? true : false
>;
/** Intake's five kinds are a subset of `catalog_record_kind` too (CAM-47). */
export type IntakeKindLocked = Locked<
  [`${IntakeKind}`] extends [Enums['catalog_record_kind']] ? true : false
>;
export type CategoryLocked = Locked<SameSet<`${Category}`, Enums['camp_category']>>;
