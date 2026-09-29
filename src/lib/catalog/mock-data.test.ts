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
 *   what its sources said: the two brochures in docs/data/ and acac's
 *   enrollment page. Those checks are
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
    expect(mockProviders).toHaveLength(5);
    expect(mockProviders.map((provider) => provider.name).sort()).toEqual([
      'Richmond Ballet',
      'Sports Center of Richmond',
      'SwimRVA',
      'VCU Baseball',
      'acac',
    ]);
  });
});

describe('mockLocations', () => {
  it('has one entry per physical site in the source documents', () => {
    expect(mockLocations).toHaveLength(9);
    for (const location of mockLocations) {
      expect(location.state).toBe('VA');
      expect(location.address.length).toBeGreaterThan(0);
      expect(location.city.length).toBeGreaterThan(0);
    }
  });
});

describe('mockCamps', () => {
  it('has one entry per camp or class in the source documents', () => {
    // 12 acac weekly themes + 2 acac tennis variants + 1 VCU Baseball program
    // + 6 SwimRVA camps + 2 SCOR camps + 3 Richmond Ballet camps.
    expect(mockCamps).toHaveLength(26);
  });
});

describe('mockSessions', () => {
  it('fully transcribes every dated offering from both source documents', () => {
    // acac: 12 general weeks + 9 Junior Mini Tennis dates + 3 Tournament All Day
    // dates = 24. VCU Baseball: 4. SwimRVA: 27. SCOR: 10 summer weeks + 17
    // holiday days = 27. Richmond Ballet: 6. 88 total, not a representative sample.
    expect(mockSessions).toHaveLength(88);
  });

  it("gives every general-camp week the enrollment page's hours, price, grades, categories, and registration link", () => {
    // The brochure states none of these; acac's enrollment page does
    // (acacmidlothian.campmanagement.com, Summer Camp 2026).
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
      expect(session.startTime).toBe('07:00');
      expect(session.endTime).toBe('18:00');
      expect(session.priceCents).toBe(49_500);
      expect(session.priceNote).toBe('acac member price: $440/week');
      expect(session.gradeRange).toEqual({ min: 0, max: 8 });
      expect(session.ageRange).toBeUndefined();
    }
    const generalCamps = mockCamps.filter((camp) => generalCampIds.has(camp.id));
    expect(generalCamps).toHaveLength(12);
    for (const camp of generalCamps) {
      // "Activities include field trips, daily swimming, sports, arts and
      // crafts, games and more", with indoor and outdoor activities daily.
      expect(camp.categories).toEqual([Category.Sports, Category.Arts, Category.Outdoors]);
      expect(camp.registrationInfo?.url).toBe(
        'https://acacmidlothian.campmanagement.com/p/request_for_info_m.php?action=enroll',
      );
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

  it('dates Glow Week July 27-31, as the enrollment page does, not the brochure\'s impossible "June 27-31"', () => {
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

function sessionsOf(campId: string) {
  return mockSessions.filter((session) => session.campId === campId);
}

function datesOf(campId: string, locationId?: string) {
  return sessionsOf(campId)
    .filter((session) => locationId === undefined || session.locationId === locationId)
    .map((session) => `${session.startDate}/${session.endDate}`);
}

describe('SwimRVA (swimrichmond.org, camps schedule and pricing)', () => {
  it('lists the eleven CSAC and nine North weeks of the general summer camp', () => {
    expect(datesOf('camp-swimrva-summer-swim', 'location-swimrva-csac')).toEqual([
      '2026-06-01/2026-06-05',
      '2026-06-08/2026-06-11',
      '2026-06-15/2026-06-19',
      '2026-06-22/2026-06-25',
      '2026-06-29/2026-07-03',
      '2026-07-06/2026-07-10',
      '2026-07-13/2026-07-17',
      '2026-07-21/2026-07-24',
      '2026-07-27/2026-07-31',
      '2026-08-03/2026-08-07',
      '2026-08-10/2026-08-14',
    ]);
    expect(datesOf('camp-swimrva-summer-swim', 'location-swimrva-north')).toEqual([
      '2026-06-08/2026-06-12',
      '2026-06-15/2026-06-19',
      '2026-06-22/2026-06-26',
      '2026-06-29/2026-07-03',
      '2026-07-06/2026-07-10',
      '2026-07-13/2026-07-17',
      '2026-07-20/2026-07-24',
      '2026-07-27/2026-07-31',
      '2026-08-03/2026-08-07',
    ]);
  });

  it('prices a week at its regular price, and a 4-day week at $269, with the spring special in the note', () => {
    const byId = new Map(mockSessions.map((session) => [session.id, session]));
    expect(byId.get('session-swimrva-summer-swim-csac-2026-06-01')).toMatchObject({
      startTime: '09:00',
      endTime: '16:00',
      priceCents: 33_900,
      priceNote: '$329 if booked by May 31, 2026 (spring special)',
      ageRange: { min: 6, max: 12 },
    });
    expect(byId.get('session-swimrva-summer-swim-csac-2026-06-08')).toMatchObject({
      priceCents: 26_900,
    });
    expect(byId.get('session-swimrva-summer-swim-csac-2026-06-08')?.priceNote).toBeUndefined();
    expect(byId.get('session-swimrva-summer-swim-csac-2026-06-22')).toMatchObject({
      priceCents: 26_900,
      priceNote: '$259 if booked by May 31, 2026 (spring special)',
    });
  });

  it.each([
    {
      campId: 'camp-swimrva-spring-break',
      dates: ['2026-03-30/2026-04-03'],
      ages: { min: 6, max: 12 },
    },
    {
      campId: 'camp-swimrva-summer-league-tune-up',
      dates: ['2026-06-01/2026-06-05', '2026-06-15/2026-06-19'],
      ages: { min: 9, max: 17 },
    },
    {
      campId: 'camp-swimrva-junior-lifeguarding',
      dates: ['2026-06-29/2026-07-03', '2026-08-03/2026-08-07'],
      ages: { min: 11, max: 14 },
    },
    {
      campId: 'camp-swimrva-water-sports',
      dates: ['2026-06-22/2026-06-25'],
      ages: { min: 10, max: 15 },
    },
    { campId: 'camp-swimrva-mermaid', dates: ['2026-08-10/2026-08-14'], ages: { min: 8, max: 15 } },
  ])('gives $campId its dates and ages', ({ campId, dates, ages }) => {
    expect(datesOf(campId)).toEqual(dates);
    for (const session of sessionsOf(campId)) {
      expect(session.ageRange).toEqual(ages);
      expect(session.locationId).toBe('location-swimrva-csac');
    }
  });

  it('runs spring break camp 8 am to 5 pm, not the summer 9 to 4', () => {
    expect(sessionsOf('camp-swimrva-spring-break')[0]).toMatchObject({
      startTime: '08:00',
      endTime: '17:00',
      priceCents: 33_900,
    });
  });
});

describe('Sports Center of Richmond (scor-richmond.com camps, and its DaySmart listing)', () => {
  it('lists the ten dated 2027 summer weeks at the week price, ages 5-12', () => {
    expect(datesOf('camp-scor-all-sports-summer')).toEqual([
      '2027-05-31/2027-06-04',
      '2027-06-07/2027-06-11',
      '2027-06-14/2027-06-18',
      '2027-06-21/2027-06-25',
      '2027-06-28/2027-07-02',
      '2027-07-05/2027-07-09',
      '2027-07-12/2027-07-16',
      '2027-07-19/2027-07-23',
      '2027-07-26/2027-07-30',
      '2027-08-02/2027-08-06',
    ]);
    for (const session of sessionsOf('camp-scor-all-sports-summer')) {
      expect(session).toMatchObject({
        locationId: 'location-scor',
        startTime: '09:00',
        endTime: '17:00',
        priceCents: 40_000,
        priceNote: 'Or $90/day. Half day $55/day or $225/week. $20/year SCOR membership required.',
        ageRange: { min: 5, max: 12 },
      });
    }
  });

  it('lists each 2026-27 school holiday camp day as its own one-day session', () => {
    expect(datesOf('camp-scor-school-holiday').map((range) => range.split('/')[0])).toEqual([
      '2026-09-04',
      '2026-09-21',
      '2026-09-28',
      '2026-10-12',
      '2026-11-02',
      '2026-11-03',
      '2026-11-09',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-12-21',
      '2026-12-22',
      '2026-12-23',
      '2026-12-24',
      '2026-12-28',
      '2026-12-29',
      '2026-12-31',
    ]);
    for (const session of sessionsOf('camp-scor-school-holiday')) {
      expect(session.endDate).toBe(session.startDate);
      expect(session).toMatchObject({
        startTime: '09:00',
        endTime: '17:00',
        priceCents: 9_000,
        priceNote: 'Half day 9:00–12:30: $55. $20/year SCOR membership required.',
      });
    }
  });
});

describe('Richmond Ballet (richmondballet.com, summer camps and classes)', () => {
  it.each([
    {
      campId: 'camp-srb-invitation-to-the-dance-camp',
      sessions: [
        { startDate: '2026-06-15', endDate: '2026-06-18', priceCents: 18_000 },
        { startDate: '2026-07-27', endDate: '2026-07-31', priceCents: 22_500 },
      ],
      startTime: '09:00',
      endTime: '11:00',
    },
    {
      campId: 'camp-srb-dance-camp',
      sessions: [
        { startDate: '2026-06-15', endDate: '2026-06-18', priceCents: 34_000 },
        { startDate: '2026-07-27', endDate: '2026-07-31', priceCents: 42_000 },
      ],
      startTime: '09:00',
      endTime: '14:00',
    },
    {
      campId: 'camp-srb-minds-in-motion',
      sessions: [
        { startDate: '2026-07-27', endDate: '2026-07-31', priceCents: 35_000 },
        { startDate: '2026-08-03', endDate: '2026-08-07', priceCents: 35_000 },
      ],
      startTime: '09:00',
      endTime: '16:00',
    },
  ])(
    'gives each $campId week its dates, hours, and tuition',
    ({ campId, sessions, startTime, endTime }) => {
      const actual = sessionsOf(campId);
      expect(actual).toHaveLength(sessions.length);
      sessions.forEach((expected, index) => {
        expect(actual[index]).toMatchObject({ ...expected, startTime, endTime });
      });
    },
  );

  it('keeps age and grade apart: Minds In Motion states grades 5-8 and no ages', () => {
    for (const session of sessionsOf('camp-srb-minds-in-motion')) {
      expect(session.gradeRange).toEqual({ min: 5, max: 8 });
      expect(session.ageRange).toBeUndefined();
    }
  });

  // Out of scope: a session meets every weekday of its date range (CAM-27). The
  // summer classes meet one or two days a week for five weeks, and the Mini
  // Intensive Tuesday to Thursday afternoons, so none of them is listed.
  it.each([
    'camp-srb-lower-iii-mini-intensive',
    'camp-srb-invitation-to-the-dance-class',
    'camp-srb-primary-class',
    'camp-srb-lower-ballet',
    'camp-srb-lower-theatre-dance',
    'camp-srb-lower-character-dance',
    'camp-srb-lower-modern',
  ])('leaves out %s, which does not meet every weekday of its term', (campId) => {
    expect(mockCamps.map((camp) => camp.id)).not.toContain(campId);
    expect(sessionsOf(campId)).toHaveLength(0);
  });
});
