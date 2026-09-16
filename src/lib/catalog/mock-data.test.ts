import { assertCalendarDate, compareDates } from '@campout/planner';
import { describe, expect, it } from 'vitest';
import { mockCamps, mockLocations, mockProviders, mockSessions } from './mock-data';
import { Category } from './types';

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

  it('only references providers that exist', () => {
    const providerIds = new Set(mockProviders.map((provider) => provider.id));
    for (const camp of mockCamps) {
      expect(providerIds.has(camp.providerId)).toBe(true);
    }
  });

  it('gives every camp at least one category from the closed enum', () => {
    for (const camp of mockCamps) {
      expect(camp.categories.length).toBeGreaterThan(0);
      for (const category of camp.categories) {
        expect(Object.values(Category)).toContain(category);
      }
    }
  });
});

describe('mockSessions', () => {
  it('fully transcribes every dated offering from both source documents', () => {
    // acac: 12 general weeks + 9 Junior Mini Tennis dates + 3 Tournament All Day
    // dates = 24. VCU Baseball: 4 sessions. 28 total, not a representative sample.
    expect(mockSessions).toHaveLength(28);
  });

  it('only references camps and locations that exist', () => {
    const campIds = new Set(mockCamps.map((camp) => camp.id));
    const locationIds = new Set(mockLocations.map((location) => location.id));
    for (const session of mockSessions) {
      expect(campIds.has(session.campId)).toBe(true);
      expect(locationIds.has(session.locationId)).toBe(true);
    }
  });

  it('carries only real calendar dates, with the end on or after the start', () => {
    for (const session of mockSessions) {
      const start = assertCalendarDate(session.startDate, `${session.id}.startDate`);
      const end = assertCalendarDate(session.endDate, `${session.id}.endDate`);
      expect(compareDates(end, start)).toBeGreaterThanOrEqual(0);
    }
  });

  it('never prices a session with a negative or fractional cent amount', () => {
    for (const session of mockSessions) {
      expect(Number.isInteger(session.priceCents)).toBe(true);
      expect(session.priceCents).toBeGreaterThanOrEqual(0);
    }
  });

  it('leaves ageRange and gradeRange null where the source states no restriction', () => {
    const vcuSessions = mockSessions.filter((session) => session.campId === 'camp-vcu-summer-youth');
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

  it('gives every Junior Mini Tennis Camp date the beginner price, hours, and age range', () => {
    const juniorMini = mockSessions.filter((session) => session.campId === 'camp-junior-mini-tennis');
    expect(juniorMini).toHaveLength(9);
    for (const session of juniorMini) {
      expect(session.priceCents).toBe(25_500);
      expect(session.startTime).toBe('10:30');
      expect(session.endTime).toBe('13:30');
      expect(session.ageRange).toEqual({ min: 5, max: 15 });
    }
  });

  it('gives every Tournament All Day Camp date the advanced price, hours, and age range', () => {
    const tournament = mockSessions.filter((session) => session.campId === 'camp-tournament-all-day-tennis');
    expect(tournament).toHaveLength(3);
    for (const session of tournament) {
      expect(session.priceCents).toBe(43_500);
      expect(session.startTime).toBe('10:00');
      expect(session.endTime).toBe('16:30');
      expect(session.ageRange).toEqual({ min: 9, max: 18 });
    }
  });

  it('gives every VCU session the price and hours printed on its own line of the flyer', () => {
    const byId = new Map(mockSessions.map((session) => [session.id, session]));
    expect(byId.get('session-vcu-rfp-week-1')).toMatchObject({ priceCents: 41_500, startTime: '09:00', endTime: '14:00' });
    expect(byId.get('session-vcu-robious')).toMatchObject({ priceCents: 41_500, startTime: '09:00', endTime: '14:00' });
    expect(byId.get('session-vcu-ironbridge')).toMatchObject({ priceCents: 29_900, startTime: '09:00', endTime: '12:00' });
    expect(byId.get('session-vcu-rfp-week-2')).toMatchObject({ priceCents: 41_500, startTime: '09:00', endTime: '14:00' });
  });
});
