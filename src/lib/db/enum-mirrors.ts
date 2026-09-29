import type { CalendarType, ClosureTag, SchoolDistrict } from '@campout/planner';
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
