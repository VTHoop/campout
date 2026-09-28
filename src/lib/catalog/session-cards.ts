import type { CalendarDate } from '@campout/planner';
import type {
  AgeRange,
  Camp,
  Category,
  GradeRange,
  Location,
  Provider,
  Session,
  WallClockTime,
} from './types';

export enum RegistrationKind {
  Register = 'register',
  Call = 'call',
  Website = 'website',
}

export type Registration =
  | { readonly kind: RegistrationKind.Register; readonly url: string }
  | { readonly kind: RegistrationKind.Call; readonly phone: string }
  | { readonly kind: RegistrationKind.Website; readonly url: string };

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
}

export interface Catalog {
  readonly providers: readonly Provider[];
  readonly locations: readonly Location[];
  readonly camps: readonly Camp[];
  readonly sessions: readonly Session[];
}

export function sessionCardsFrom(_catalog: Catalog): readonly SessionCardView[] {
  return [];
}

export function listSessionCards(): Promise<readonly SessionCardView[]> {
  return Promise.resolve([]);
}
