/**
 * The camp categories a parent filters by: the database's `camp_category`
 * enum, value for value (ADR-0018; the lock is in `src/lib/db/enum-mirrors.ts`).
 * A camp holds one or several; `day_camp` is for a general program and stands
 * alone.
 */
export enum Category {
  DayCamp = 'day_camp',
  Sports = 'sports',
  STEM = 'stem',
  Arts = 'arts',
  Outdoors = 'outdoors',
  Academic = 'academic',
  FaithBased = 'faith_based',
}

/** Wall-clock time of day, `HH:MM` in 24-hour time. Never a `Date`, never timezone-bearing. */
export type WallClockTime = string;

/** Age is optional, independent of grade, and never derived from one. */
export interface AgeRange {
  readonly min?: number;
  readonly max?: number;
}

/** Grade is optional, independent of age, and never derived from one. */
export interface GradeRange {
  readonly min?: number;
  readonly max?: number;
}

/**
 * The catalog records a reviewer can approve from a card: the database's
 * `catalog_record_kind` enum, narrowed to the four a card shows (CAM-46).
 */
export enum RecordKind {
  Provider = 'provider',
  Camp = 'camp',
  Location = 'location',
  Session = 'session',
}
