import { describe, expect, it } from 'vitest';
import type { Camp, Location, Provider, Session } from '../types';
import { Category } from '../types';
import type { CatalogSnapshot } from '../validateCatalog';
import { findImportGaps, mapCatalogToDrafts } from './map-catalog';

/**
 * Invented catalog, never the real mock (CAM-28 AC: tests don't use real
 * camps as fixtures). `ready()` is a catalog that clears every gate; each
 * test changes only the one fact it is about.
 */
const PROVIDER: Provider = {
  id: 'p1',
  name: 'Fixture Rec League',
  website: 'https://example.test',
  source: { url: 'https://example.test/camps-2027' },
};

const LOCATION: Location = {
  id: 'l1',
  name: 'Fixture Community Center',
  address: '100 Test Way',
  city: 'Richmond',
  state: 'VA',
  postalCode: '23220',
  lat: 37.5407,
  long: -77.436,
};

const CAMP: Camp = {
  id: 'c1',
  name: 'Fixture Day Camp',
  description: 'A short summary we wrote.',
  providerId: 'p1',
  categories: [Category.Sports, Category.Outdoors],
  registrationInfo: { url: 'https://example.test/register' },
};

const SESSION: Session = {
  id: 's1',
  campId: 'c1',
  locationId: 'l1',
  startDate: '2027-07-12',
  endDate: '2027-07-16',
  startTime: '09:00',
  endTime: '17:00',
  priceCents: 40_000,
  priceNote: 'Or $90/day.',
  ageRange: { min: 6, max: 12 },
  gradeRange: { min: 1, max: 6 },
};

function ready(): CatalogSnapshot {
  return { providers: [PROVIDER], locations: [LOCATION], camps: [CAMP], sessions: [SESSION] };
}

describe('mapCatalogToDrafts', () => {
  it('maps a provider, with its source and no status', () => {
    const { providers } = mapCatalogToDrafts(ready());
    expect(providers).toEqual([
      {
        ref: 'p1',
        row: {
          name: 'Fixture Rec League',
          website_url: 'https://example.test',
          source_url: 'https://example.test/camps-2027',
        },
      },
    ]);
  });

  it('maps a location, point as longitude then latitude, with its provider’s source', () => {
    const { locations } = mapCatalogToDrafts(ready());
    expect(locations).toEqual([
      {
        ref: 'l1',
        row: {
          label: 'Fixture Community Center',
          street: '100 Test Way',
          city: 'Richmond',
          state: 'VA',
          postal_code: '23220',
          point: 'SRID=4326;POINT(-77.436 37.5407)',
          source_url: 'https://example.test/camps-2027',
        },
      },
    ]);
  });

  it('maps a camp: categories to the database enum, registration link, and the provider’s source', () => {
    const { camps } = mapCatalogToDrafts(ready());
    expect(camps).toEqual([
      {
        ref: 'c1',
        providerRef: 'p1',
        row: {
          name: 'Fixture Day Camp',
          summary: 'A short summary we wrote.',
          categories: ['sports', 'outdoors'],
          registration_url: 'https://example.test/register',
          source_url: 'https://example.test/camps-2027',
        },
      },
    ]);
  });

  it('maps faith-based to faith_based', () => {
    const catalog = ready();
    const camp = { ...CAMP, categories: [Category.FaithBased] };
    const { camps } = mapCatalogToDrafts({ ...catalog, camps: [camp] });
    expect(camps[0]?.row.categories).toEqual(['faith_based']);
  });

  it('turns a phone-and-notes registration into a registration note', () => {
    const catalog = ready();
    const camp = {
      ...CAMP,
      registrationInfo: { phone: '804-555-0100', notes: 'Register on the app.' },
    };
    const { camps } = mapCatalogToDrafts({ ...catalog, camps: [camp] });
    expect(camps[0]?.row.registration_url).toBeUndefined();
    expect(camps[0]?.row.registration_note).toBe('Call 804-555-0100. Register on the app.');
  });

  it('maps a session’s dates, ages and grades, and links it to its camp and location', () => {
    const { sessions } = mapCatalogToDrafts(ready());
    expect(sessions).toEqual([
      {
        ref: 's1',
        campRef: 'c1',
        locationRef: 'l1',
        row: {
          start_date: '2027-07-12',
          end_date: '2027-07-16',
          min_age: 6,
          max_age: 12,
          min_grade: 1,
          max_grade: 6,
          source_url: 'https://example.test/camps-2027',
        },
      },
    ]);
  });

  it('gives a session one option carrying its hours, price and price note', () => {
    const { options } = mapCatalogToDrafts(ready());
    expect(options).toEqual([
      {
        sessionRef: 's1',
        row: {
          kind: 'full_day',
          daily_start: '09:00',
          daily_end: '17:00',
          price_cents: 40_000,
          price_note: 'Or $90/day.',
        },
      },
    ]);
  });

  it.each([
    ['ends by 13:00', '09:00', '12:00', 'morning'],
    ['starts at 12:00 or later', '13:00', '17:00', 'afternoon'],
    ['spans the middle of the day', '09:00', '16:30', 'full_day'],
  ])('reads a session that %s as a %s option', (_label, startTime, endTime, kind) => {
    const catalog = ready();
    const session = { ...SESSION, startTime, endTime };
    const { options } = mapCatalogToDrafts({ ...catalog, sessions: [session] });
    expect(options[0]?.row.kind).toBe(kind);
  });

  it('keeps a session with no hours or price as a full-day option with none stated', () => {
    const catalog = ready();
    const { startTime, endTime, priceCents, priceNote, ...bare } = SESSION;
    const { options } = mapCatalogToDrafts({ ...catalog, sessions: [bare] });
    expect(options[0]?.row).toEqual({ kind: 'full_day' });
  });

  it('stores a source document path when the provider has no URL', () => {
    const catalog = ready();
    const provider = { ...PROVIDER, source: { documentPath: 'flyer-2027.jpg' } };
    const { providers, camps, sessions, locations } = mapCatalogToDrafts({
      ...catalog,
      providers: [provider],
    });
    for (const { row } of [...providers, ...camps, ...sessions, ...locations]) {
      expect(row).toMatchObject({ source_document_path: 'flyer-2027.jpg' });
      expect(row).not.toHaveProperty('source_url');
    }
  });

  it('drafts only: no row sets a status or any verified field', () => {
    const drafts = mapCatalogToDrafts(ready());
    const rows = [
      ...drafts.providers,
      ...drafts.locations,
      ...drafts.camps,
      ...drafts.sessions,
      ...drafts.options,
    ];
    for (const { row } of rows) {
      expect(row).not.toHaveProperty('status');
      expect(row).not.toHaveProperty('verified_at');
      expect(row).not.toHaveProperty('verified_by');
    }
  });

  it('throws on a session whose camp is not in the catalog', () => {
    const catalog = ready();
    const session = { ...SESSION, campId: 'nope' };
    expect(() => mapCatalogToDrafts({ ...catalog, sessions: [session] })).toThrow(/nope/);
  });
});

describe('findImportGaps', () => {
  it('is empty for a catalog that is ready', () => {
    expect(findImportGaps(ready())).toEqual([]);
  });

  it('names a location with no coordinates', () => {
    const catalog = ready();
    const { lat, long, ...bare } = LOCATION;
    expect(findImportGaps({ ...catalog, locations: [bare] })).toEqual([
      'Location "Fixture Community Center": no coordinates',
    ]);
  });

  it('names a location with no postal code', () => {
    const catalog = ready();
    const { postalCode, ...bare } = LOCATION;
    expect(findImportGaps({ ...catalog, locations: [bare] })).toEqual([
      'Location "Fixture Community Center": no postal code',
    ]);
  });

  it('names a provider with no source', () => {
    const catalog = ready();
    const { source, ...bare } = PROVIDER;
    expect(findImportGaps({ ...catalog, providers: [bare] })).toEqual([
      'Provider "Fixture Rec League": no source',
    ]);
  });

  it('refuses a provider whose only "source" is its website or a registration link', () => {
    const catalog = ready();
    const asWebsite = { ...PROVIDER, source: { url: 'https://example.test' } };
    const asRegistration = {
      ...PROVIDER,
      source: { url: 'https://example.test/register' },
    };
    const expected = [
      'Provider "Fixture Rec League": source is the provider website or a registration link, not the page the facts came from',
    ];
    expect(findImportGaps({ ...catalog, providers: [asWebsite] })).toEqual(expected);
    expect(findImportGaps({ ...catalog, providers: [asRegistration] })).toEqual(expected);
  });

  it('names a location no session uses, rather than guessing a source for it', () => {
    const catalog = ready();
    const spare = { ...LOCATION, id: 'l2', name: 'Fixture Annex' };
    expect(findImportGaps({ ...catalog, locations: [...catalog.locations, spare] })).toEqual([
      'Location "Fixture Annex": no session uses it, so it has no source',
    ]);
  });

  it('lists every gap at once, and mapCatalogToDrafts refuses with the same list', () => {
    const catalog = ready();
    const { lat, long, ...noCoordinates } = LOCATION;
    const { source, ...noSource } = PROVIDER;
    const broken = { ...catalog, locations: [noCoordinates], providers: [noSource] };
    const gaps = findImportGaps(broken);
    expect(gaps).toHaveLength(2);
    expect(() => mapCatalogToDrafts(broken)).toThrow(gaps.join('\n'));
  });
});
