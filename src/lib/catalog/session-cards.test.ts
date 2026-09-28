import { describe, expect, it } from 'vitest';
import { mockSessions } from './mock-data';
import {
  type Catalog,
  listSessionCards,
  RegistrationKind,
  type SessionCardView,
  sessionCardsFrom,
} from './session-cards';
import { Category } from './types';

/**
 * The data-access service behind the session cards (CAM-32). The page and the
 * card read only its view objects, so CAM-28 can swap the mock catalog for
 * Supabase behind it.
 */

const CATALOG: Catalog = {
  providers: [
    { id: 'provider-a', name: 'Provider A', website: 'https://provider-a.example' },
    { id: 'provider-b', name: 'Provider B' },
  ],
  locations: [
    { id: 'location-a', name: 'Park A', address: '1 Main St', city: 'Chester', state: 'VA' },
  ],
  camps: [
    {
      id: 'camp-url',
      name: 'Registers online',
      description: 'A camp.',
      providerId: 'provider-a',
      categories: [Category.Sports, Category.STEM],
      registrationInfo: {
        url: 'https://camp.example/register',
        phone: '804-555-0100',
        notes: 'Opens March 1.',
      },
    },
    {
      id: 'camp-phone',
      name: 'Registers by phone',
      description: 'A camp.',
      providerId: 'provider-a',
      categories: [Category.Arts],
      registrationInfo: { phone: '804-555-0100' },
    },
    {
      id: 'camp-provider-site',
      name: 'Only a provider site',
      description: 'A camp.',
      providerId: 'provider-a',
      categories: [Category.Outdoors],
    },
    {
      id: 'camp-nothing',
      name: 'No way to register',
      description: 'A camp.',
      providerId: 'provider-b',
      categories: [Category.Academic],
      registrationInfo: { notes: 'Ask at the front desk.' },
    },
  ],
  sessions: [
    {
      id: 'session-url',
      campId: 'camp-url',
      locationId: 'location-a',
      startDate: '2026-08-03',
      endDate: '2026-08-05',
      startTime: '09:00',
      endTime: '12:00',
      priceCents: 29_900,
      priceNote: 'Sibling discount available.',
      ageRange: { min: 5, max: 15 },
      gradeRange: { min: 0, max: 5 },
    },
    {
      id: 'session-phone',
      campId: 'camp-phone',
      locationId: 'location-a',
      startDate: '2026-08-03',
      endDate: '2026-08-07',
    },
    {
      id: 'session-provider-site',
      campId: 'camp-provider-site',
      locationId: 'location-a',
      startDate: '2026-08-03',
      endDate: '2026-08-07',
    },
    {
      id: 'session-nothing',
      campId: 'camp-nothing',
      locationId: 'location-a',
      startDate: '2026-08-03',
      endDate: '2026-08-07',
    },
  ],
};

function card(id: string): SessionCardView {
  const found = sessionCardsFrom(CATALOG).find((view) => view.id === id);
  if (!found) throw new Error(`No card ${id}`);
  return found;
}

describe('sessionCardsFrom', () => {
  it('joins a session to its camp, provider and location', () => {
    expect(card('session-url')).toEqual({
      id: 'session-url',
      campName: 'Registers online',
      providerName: 'Provider A',
      locationName: 'Park A',
      city: 'Chester',
      startDate: '2026-08-03',
      endDate: '2026-08-05',
      startTime: '09:00',
      endTime: '12:00',
      priceCents: 29_900,
      priceNote: 'Sibling discount available.',
      ageRange: { min: 5, max: 15 },
      gradeRange: { min: 0, max: 5 },
      categories: [Category.Sports, Category.STEM],
      registration: { kind: RegistrationKind.Register, url: 'https://camp.example/register' },
      registrationNotes: 'Opens March 1.',
    });
  });

  it('leaves unstated facts out rather than defaulting them', () => {
    const view = card('session-phone');
    expect(view.startTime).toBeUndefined();
    expect(view.endTime).toBeUndefined();
    expect(view.priceCents).toBeUndefined();
    expect(view.priceNote).toBeUndefined();
    expect(view.ageRange).toBeUndefined();
    expect(view.gradeRange).toBeUndefined();
  });

  it('offers a call when the camp has a phone number but no registration URL', () => {
    expect(card('session-phone').registration).toEqual({
      kind: RegistrationKind.Call,
      phone: '804-555-0100',
    });
  });

  it("falls back to the provider's website when the camp has neither", () => {
    expect(card('session-provider-site').registration).toEqual({
      kind: RegistrationKind.Website,
      url: 'https://provider-a.example',
    });
  });

  it('offers no registration when there is nowhere to send the parent, but keeps the notes', () => {
    const view = card('session-nothing');
    expect(view.registration).toBeUndefined();
    expect(view.registrationNotes).toBe('Ask at the front desk.');
  });

  it.each([
    ['camp', { campId: 'camp-missing' }],
    ['location', { locationId: 'location-missing' }],
  ])('refuses a session whose %s is not in the catalog', (_what, broken) => {
    const [first] = CATALOG.sessions;
    if (!first) throw new Error('No session');
    expect(() => sessionCardsFrom({ ...CATALOG, sessions: [{ ...first, ...broken }] })).toThrow();
  });

  it('refuses a camp whose provider is not in the catalog', () => {
    expect(() => sessionCardsFrom({ ...CATALOG, providers: [] })).toThrow();
  });
});

describe('listSessionCards', () => {
  it('returns a card for every session in the catalog', async () => {
    const cards = await listSessionCards();
    expect(cards.map((view) => view.id)).toEqual(mockSessions.map((session) => session.id));
  });

  it('carries the VCU Ironbridge session as its card', async () => {
    const cards = await listSessionCards();
    expect(cards.find((view) => view.id === 'session-vcu-ironbridge')).toMatchObject({
      campName: 'VCU Baseball Summer Youth Camps',
      providerName: 'VCU Baseball',
      locationName: 'Ironbridge Sports Park',
      city: 'Chester',
      registration: { kind: RegistrationKind.Register, url: 'https://ramsbaseballcamps.com' },
    });
  });
});
