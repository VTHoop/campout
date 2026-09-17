import { describe, expect, it } from 'vitest';
import { mockCamps, mockLocations, mockProviders, mockSessions } from './mock-data';
import { Category } from './types';
import { findCatalogInconsistencies } from './validateCatalog';

/**
 * Two different things are checked in this file, and they scale on
 * different axes:
 *
 * - "Is this catalog snapshot internally consistent" is a structural
 *   invariant that applies to any Camp/Session/Location/Provider data, real
 *   or a test fixture. That check lives once, in validateCatalog.ts, and is
 *   just invoked here — see the first test below.
 * - Everything else here is transcription QA: does the mock data still say
 *   what the two source brochures in docs/data/ said. Those checks are
 *   specific to this seed data and will grow only when that data changes,
 *   not when new behavior is added elsewhere in src/lib/catalog.
 */
describe('mock catalog data', () => {
  it('has no structural inconsistencies across providers, locations, camps, and sessions', () => {
    expect(
      findCatalogInconsistencies({
        providers: mockProviders,
        locations: mockLocations,
        camps: mockCamps,
        sessions: mockSessions,
      }),
    ).toEqual([]);
  });
});

describe('Category', () => {
  it('is the closed six-value enum from the AC', () => {
    expect(Object.values(Category).sort()).toEqual(
      ['academic', 'arts', 'faith-based', 'outdoors', 'sports', 'stem'].sort(),
    );
  });
});

describe('mockProviders', () => {
  it('has one entry per organization in the source documents', () => {
    expect(mockProviders).toHaveLength(2);
    expect(mockProviders.map((provider) => provider.name).sort()).toEqual(['VCU Baseball', 'acac']);
  });
});

describe('mockLocations', () => {
  it('has one entry per physical site in the source documents', () => {
    expect(mockLocations).toHaveLength(4);
    for (const location of mockLocations) {
      expect(location.state).toBe('VA');
      expect(location.address.length).toBeGreaterThan(0);
      expect(location.city.length).toBeGreaterThan(0);
    }
  });
});

describe('mockCamps', () => {
  it('has one entry per acac general-camp week, tennis variant, and VCU program', () => {
    // 12 acac weekly themes + 2 acac tennis variants + 1 VCU Baseball program.
    expect(mockCamps).toHaveLength(15);
  });
});

describe('mockSessions', () => {
  it('fully transcribes every dated offering from both source documents', () => {
    // acac: 12 general weeks + 9 Junior Mini Tennis dates + 3 Tournament All Day
    // dates = 24. VCU Baseball: 4 sessions. 28 total, not a representative sample.
    expect(mockSessions).toHaveLength(28);
  });

  it('leaves startTime, endTime, and priceCents undefined for the general-camp weeks, since the brochure states none', () => {
    const generalCampIds = new Set([
      'camp-wacky-water-welcome',
      'camp-magical-mess',
      'camp-animal-planet',
      'camp-blast-from-the-past',
      'camp-america-the-beautiful',
      'camp-hollywood',
      'camp-global-games',
      'camp-space-explorers',
      'camp-glow-week',
      'camp-game-on',
      'camp-surfs-up',
      'camp-sayonara-summer',
    ]);
    const generalSessions = mockSessions.filter((session) => generalCampIds.has(session.campId));
    expect(generalSessions).toHaveLength(12);
    for (const session of generalSessions) {
      expect(session.startTime).toBeUndefined();
      expect(session.endTime).toBeUndefined();
      expect(session.priceCents).toBeUndefined();
    }
  });

  it('leaves ageRange and gradeRange null where the source states no restriction', () => {
    const vcuSessions = mockSessions.filter(
      (session) => session.campId === 'camp-vcu-summer-youth',
    );
    expect(vcuSessions).toHaveLength(4);
    for (const session of vcuSessions) {
      expect(session.ageRange).toBeUndefined();
      expect(session.gradeRange).toBeUndefined();
    }
  });

  it('corrects the brochure\'s impossible "June 27-31" Glow Week date to the sequential July 27-31 week', () => {
    const glowWeek = mockSessions.find((session) => session.campId === 'camp-glow-week');
    expect(glowWeek?.startDate).toBe('2026-07-27');
    expect(glowWeek?.endDate).toBe('2026-07-31');
  });

  it.each([
    {
      label: 'Junior Mini Tennis Camp',
      campId: 'camp-junior-mini-tennis',
      expectedCount: 9,
      priceCents: 25_500,
      priceNote: 'acac member price: $225',
      startTime: '10:30',
      endTime: '13:30',
      ageRange: { min: 5, max: 15 },
    },
    {
      label: 'Tournament All Day Camp',
      campId: 'camp-tournament-all-day-tennis',
      expectedCount: 3,
      priceCents: 43_500,
      priceNote: 'acac member price: $395',
      startTime: '10:00',
      endTime: '16:30',
      ageRange: { min: 9, max: 18 },
    },
  ])(
    'gives every $label date the same price, member price note, hours, and age range',
    ({ campId, expectedCount, priceCents, priceNote, startTime, endTime, ageRange }) => {
      const sessions = mockSessions.filter((session) => session.campId === campId);
      expect(sessions).toHaveLength(expectedCount);
      for (const session of sessions) {
        expect(session.priceCents).toBe(priceCents);
        expect(session.priceNote).toBe(priceNote);
        expect(session.startTime).toBe(startTime);
        expect(session.endTime).toBe(endTime);
        expect(session.ageRange).toEqual(ageRange);
      }
    },
  );

  it.each([
    { id: 'session-vcu-rfp-week-1', priceCents: 41_500, startTime: '09:00', endTime: '14:00' },
    { id: 'session-vcu-robious', priceCents: 41_500, startTime: '09:00', endTime: '14:00' },
    { id: 'session-vcu-ironbridge', priceCents: 29_900, startTime: '09:00', endTime: '12:00' },
    { id: 'session-vcu-rfp-week-2', priceCents: 41_500, startTime: '09:00', endTime: '14:00' },
  ])(
    'gives $id the price and hours printed on its own line of the flyer',
    ({ id, ...expected }) => {
      const byId = new Map(mockSessions.map((session) => [session.id, session]));
      expect(byId.get(id)).toMatchObject(expected);
    },
  );
});
