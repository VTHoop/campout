import type { CalendarDate } from '@campout/planner';

/**
 * The closed set of camp themes a parent filters by (CAM-1 AC). A camp can
 * hold one or many. A TS string enum per AGENTS.md → Code conventions: this
 * is not yet a persisted domain, so there is no generated type to guard-lock
 * against.
 */
export enum Category {
  Sports = 'sports',
  STEM = 'stem',
  Arts = 'arts',
  Outdoors = 'outdoors',
  Academic = 'academic',
  FaithBased = 'faith-based',
}

/** Wall-clock time of day, `HH:MM` in 24-hour time. Never a `Date`, never timezone-bearing. */
export type WallClockTime = string;

/** An organization that runs one or more camps. */
export interface Provider {
  readonly id: string;
  readonly name: string;
  readonly website?: string;
}

/** A physical site a session runs at. */
export interface Location {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly city: string;
  readonly state: string;
  readonly lat?: number;
  readonly long?: number;
}

/** How a parent signs up, since sources vary between links, phone numbers, and app-based registration. */
export interface RegistrationInfo {
  readonly url?: string;
  readonly phone?: string;
  readonly notes?: string;
}

/**
 * An offering a provider runs. Location, price, and time live on `Session`,
 * not here, because one camp can run sessions at different locations,
 * prices, and times.
 */
export interface Camp {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly providerId: string;
  readonly categories: readonly Category[];
  readonly registrationInfo?: RegistrationInfo;
}

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

/** A dated offering of a `Camp`. This is what a parent actually shops for. */
export interface Session {
  readonly id: string;
  readonly campId: string;
  readonly locationId: string;
  readonly startDate: CalendarDate;
  readonly endDate: CalendarDate;
  readonly startTime: WallClockTime;
  readonly endTime: WallClockTime;
  /** Single non-member price, integer cents. Member/non-member tiering is out of scope for v1. */
  readonly priceCents: number;
  readonly ageRange?: AgeRange;
  readonly gradeRange?: GradeRange;
}
