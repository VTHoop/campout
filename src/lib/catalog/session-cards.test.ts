import { describe, expect, it } from 'vitest';
import {
  RegistrationKind,
  type SessionCardRow,
  type SessionCardView,
  sessionCardsFromRows,
  VerificationKind,
} from './session-cards';
import { Category } from './types';

/**
 * The data-access service behind the session cards (CAM-32, CAM-28): database
 * rows in, `SessionCardView` out. Rows are invented; the real query, and what
 * RLS lets each kind of visitor see, are in `supabase/tests/session-cards.rls.test.ts`.
 */

const FULL_DAY = {
  kind: 'full_day',
  daily_start: '09:00',
  daily_end: '16:00',
  price_cents: 32_500,
  price_note: 'Sibling discount available.',
} as const;

const MORNING = {
  kind: 'morning',
  daily_start: '09:00',
  daily_end: '12:30',
  price_cents: 19_500,
  price_note: null,
} as const;

const AFTERNOON = {
  kind: 'afternoon',
  daily_start: '13:00',
  daily_end: '16:00',
  price_cents: 19_500,
  price_note: null,
} as const;

const VERIFIED_ROW: SessionCardRow = {
  id: 'session-1',
  start_date: '2027-06-21',
  end_date: '2027-06-25',
  status: 'verified',
  min_age: 5,
  max_age: 12,
  min_grade: 0,
  max_grade: 6,
  source_url: 'https://example.test/summer',
  verified_at: '2026-09-01T12:00:00Z',
  camps: {
    name: 'Fixture Day Camp',
    categories: [Category.DayCamp, Category.Sports],
    registration_url: 'https://example.test/register',
    registration_note: 'Opens March 1.',
    providers: { name: 'Fixture Rec League', website_url: 'https://example.test' },
  },
  locations: { label: 'Fixture Community Center', city: 'Midlothian' },
  session_options: [FULL_DAY],
};

function cardFor(overrides: Partial<SessionCardRow> = {}): SessionCardView {
  const [card] = sessionCardsFromRows([{ ...VERIFIED_ROW, ...overrides }]);
  if (!card) throw new Error('No card');
  return card;
}

function withCamp(camp: Partial<NonNullable<SessionCardRow['camps']>>): SessionCardView {
  if (!VERIFIED_ROW.camps) throw new Error('No camp');
  return cardFor({ camps: { ...VERIFIED_ROW.camps, ...camp } });
}

describe('sessionCardsFromRows', () => {
  it('joins a session to its camp, provider, location and option', () => {
    expect(cardFor()).toEqual({
      id: 'session-1',
      campName: 'Fixture Day Camp',
      providerName: 'Fixture Rec League',
      locationName: 'Fixture Community Center',
      city: 'Midlothian',
      startDate: '2027-06-21',
      endDate: '2027-06-25',
      startTime: '09:00',
      endTime: '16:00',
      priceCents: 32_500,
      priceNote: 'Sibling discount available.',
      ageRange: { min: 5, max: 12 },
      gradeRange: { min: 0, max: 6 },
      categories: [Category.DayCamp, Category.Sports],
      registration: { kind: RegistrationKind.Register, url: 'https://example.test/register' },
      registrationNotes: 'Opens March 1.',
      verification: { kind: VerificationKind.Verified, on: '2026-09-01' },
    });
  });

  it('keeps the rows in the order given', () => {
    const rows = ['b', 'a', 'c'].map((id) => ({ ...VERIFIED_ROW, id }));
    expect(sessionCardsFromRows(rows).map((card) => card.id)).toEqual(['b', 'a', 'c']);
  });

  describe('the option a card shows', () => {
    it('is the full day when there is one, whatever the order', () => {
      expect(cardFor({ session_options: [MORNING, AFTERNOON, FULL_DAY] }).priceCents).toBe(32_500);
    });

    it('is the morning when there is no full day', () => {
      const card = cardFor({ session_options: [AFTERNOON, MORNING] });
      expect([card.startTime, card.endTime]).toEqual(['09:00', '12:30']);
    });

    it('leaves hours and price out when the session has no option', () => {
      const card = cardFor({ session_options: [] });
      expect(card.startTime).toBeUndefined();
      expect(card.priceCents).toBeUndefined();
    });
  });

  it('leaves unstated facts out rather than defaulting them', () => {
    const card = cardFor({
      min_age: null,
      max_age: null,
      min_grade: null,
      max_grade: null,
      session_options: [
        {
          kind: 'full_day',
          daily_start: null,
          daily_end: null,
          price_cents: null,
          price_note: null,
        },
      ],
    });
    expect(card.startTime).toBeUndefined();
    expect(card.endTime).toBeUndefined();
    expect(card.priceCents).toBeUndefined();
    expect(card.priceNote).toBeUndefined();
    expect(card.ageRange).toBeUndefined();
    expect(card.gradeRange).toBeUndefined();
  });

  it('keeps an age range with one end stated', () => {
    expect(cardFor({ min_age: 7, max_age: null }).ageRange).toEqual({ min: 7 });
  });

  describe('registration', () => {
    it("is the camp's own link first", () => {
      expect(cardFor().registration).toEqual({
        kind: RegistrationKind.Register,
        url: 'https://example.test/register',
      });
    });

    it("falls back to the provider's website", () => {
      expect(withCamp({ registration_url: null }).registration).toEqual({
        kind: RegistrationKind.Website,
        url: 'https://example.test',
      });
    });

    it('offers none when there is nowhere to send the parent, but keeps the note', () => {
      const card = cardFor({
        camps: {
          ...(VERIFIED_ROW.camps as NonNullable<SessionCardRow['camps']>),
          registration_url: null,
          registration_note: 'Ask at the front desk.',
          providers: { name: 'Fixture Rec League', website_url: null },
        },
      });
      expect(card.registration).toBeUndefined();
      expect(card.registrationNotes).toBe('Ask at the front desk.');
    });
  });

  describe('verification', () => {
    it('is the Richmond day a verified session was checked, not the UTC one', () => {
      // 02:30 UTC on Sep 2 is 22:30 on Sep 1 in Richmond.
      expect(cardFor({ verified_at: '2026-09-02T02:30:00Z' }).verification).toEqual({
        kind: VerificationKind.Verified,
        on: '2026-09-01',
      });
    });

    it('is a draft, with the page it was read from, for a draft session', () => {
      expect(cardFor({ status: 'draft', verified_at: null }).verification).toEqual({
        kind: VerificationKind.Draft,
        sourceUrl: 'https://example.test/summer',
      });
    });

    it('is a draft with no link when its source is a stored document', () => {
      const card = cardFor({ status: 'draft', verified_at: null, source_url: null });
      expect(card.verification).toEqual({ kind: VerificationKind.Draft });
    });

    it('refuses a verified session with no verified date', () => {
      expect(() => cardFor({ verified_at: null })).toThrow(/session-1/);
    });

    it('refuses an archived session, which no card is for', () => {
      expect(() => cardFor({ status: 'archived' })).toThrow(/session-1/);
    });
  });

  it.each([
    ['camp', { camps: null }],
    ['location', { locations: null }],
  ])('refuses a session whose %s the database did not return', (_what, broken) => {
    expect(() => cardFor(broken)).toThrow(/session-1/);
  });

  it('refuses a camp whose provider the database did not return', () => {
    expect(() => withCamp({ providers: null })).toThrow(/session-1/);
  });
});
