import { type ChainRecord, type SessionCardView, VerificationKind } from './session-cards';
import { Category, RecordKind } from './types';

/**
 * Invented session cards for the UI suites (CAM-28): never a real camp, never
 * the database. `cardFixture` is a verified full-day card; each test changes
 * only the fact it is about.
 */

/** A card's chain, top down. Every record is verified unless `drafts` says otherwise. */
export function chainFixture({
  sessionId,
  campName,
  drafts = false,
}: {
  sessionId: string;
  campName: string;
  drafts?: boolean;
}): readonly ChainRecord[] {
  return [
    { kind: RecordKind.Provider, id: 'provider-id', name: 'Fixture Provider', isDraft: drafts },
    { kind: RecordKind.Location, id: 'location-id', name: 'Fixture Park', isDraft: drafts },
    { kind: RecordKind.Camp, id: 'camp-id', name: campName, isDraft: drafts },
    { kind: RecordKind.Session, id: sessionId, name: campName, isDraft: drafts },
  ];
}

export function cardFixture(
  id: string,
  campName: string,
  startDate: string,
  endDate: string,
  overrides: Partial<SessionCardView> = {},
): SessionCardView {
  return {
    id,
    campName,
    providerName: 'Fixture Provider',
    locationName: 'Fixture Park',
    city: 'Chester',
    startDate,
    endDate,
    categories: [Category.Sports],
    verification: { kind: VerificationKind.Verified, on: '2026-05-01' },
    records: chainFixture({ sessionId: id, campName }),
    ...overrides,
  };
}

/**
 * Summer 2026 (12 weeks from Monday June 1): two cards in week 1, three in
 * week 3, five in week 10 — one of them a Monday-to-Wednesday half day, one
 * starting on the Tuesday.
 */
export const SUMMER_2026_CARDS: readonly SessionCardView[] = [
  cardFixture('water-week', 'Fixture Water Week', '2026-06-01', '2026-06-05'),
  cardFixture('craft-week', 'Fixture Craft Week', '2026-06-01', '2026-06-05', {
    categories: [Category.Arts],
  }),
  cardFixture('wk3-a', 'Fixture Animal Week', '2026-06-15', '2026-06-19'),
  cardFixture('wk3-b', 'Fixture Robot Week', '2026-06-15', '2026-06-19', {
    categories: [Category.STEM],
  }),
  cardFixture('wk3-c', 'Fixture Tennis Camp', '2026-06-15', '2026-06-18'),
  cardFixture('baseball', 'Fixture Baseball Camp', '2026-08-03', '2026-08-05', {
    startTime: '09:00',
    endTime: '12:00',
    priceCents: 29_900,
  }),
  cardFixture('swim-1', 'Fixture Swim Camp', '2026-08-03', '2026-08-07'),
  cardFixture('swim-2', 'Fixture Swim Camp', '2026-08-03', '2026-08-07'),
  cardFixture('theater', 'Fixture Theater Camp', '2026-08-03', '2026-08-07', {
    categories: [Category.Arts],
  }),
  cardFixture('chess', 'Fixture Chess Club', '2026-08-04', '2026-08-07', {
    categories: [Category.Academic],
  }),
];
