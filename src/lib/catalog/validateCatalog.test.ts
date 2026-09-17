import { describe, expect, it } from 'vitest';
import type { Camp, Location, Provider, Session } from './types';
import { Category } from './types';
import type { CatalogSnapshot } from './validateCatalog';
import { findCatalogInconsistencies } from './validateCatalog';

// Small, purpose-built fixtures for this file's scenarios — not the real
// seed data in mock-data.ts. Each test overrides just the field it needs to
// break, so a failure points at exactly one invariant.

const provider: Provider = { id: 'provider-1', name: 'Test Provider' };

const location: Location = {
  id: 'location-1',
  name: 'Test Site',
  address: '1 Main St',
  city: 'Richmond',
  state: 'VA',
};

const camp: Camp = {
  id: 'camp-1',
  name: 'Test Camp',
  description: 'A camp for testing.',
  providerId: provider.id,
  categories: [Category.Outdoors],
};

const session: Session = {
  id: 'session-1',
  campId: camp.id,
  locationId: location.id,
  startDate: '2027-06-07',
  endDate: '2027-06-11',
};

const validSnapshot: CatalogSnapshot = {
  providers: [provider],
  locations: [location],
  camps: [camp],
  sessions: [session],
};

describe('findCatalogInconsistencies', () => {
  it('reports no issues for a consistent snapshot', () => {
    expect(findCatalogInconsistencies(validSnapshot)).toEqual([]);
  });

  it('flags a camp referencing a provider that does not exist', () => {
    const snapshot: CatalogSnapshot = {
      ...validSnapshot,
      camps: [{ ...camp, providerId: 'provider-missing' }],
    };
    expect(findCatalogInconsistencies(snapshot)).toEqual([
      "camp camp-1 references a provider that doesn't exist: provider-missing",
    ]);
  });

  it('flags a camp with no categories', () => {
    const snapshot: CatalogSnapshot = { ...validSnapshot, camps: [{ ...camp, categories: [] }] };
    expect(findCatalogInconsistencies(snapshot)).toEqual(['camp camp-1 has no categories']);
  });

  it('flags a camp with a category outside the closed enum', () => {
    const snapshot: CatalogSnapshot = {
      ...validSnapshot,
      camps: [{ ...camp, categories: ['dodgeball' as Category] }],
    };
    expect(findCatalogInconsistencies(snapshot)).toEqual([
      'camp camp-1 has an invalid category: dodgeball',
    ]);
  });

  it('flags a session referencing a camp that does not exist', () => {
    const snapshot: CatalogSnapshot = {
      ...validSnapshot,
      sessions: [{ ...session, campId: 'camp-missing' }],
    };
    expect(findCatalogInconsistencies(snapshot)).toEqual([
      "session session-1 references a camp that doesn't exist: camp-missing",
    ]);
  });

  it('flags a session referencing a location that does not exist', () => {
    const snapshot: CatalogSnapshot = {
      ...validSnapshot,
      sessions: [{ ...session, locationId: 'location-missing' }],
    };
    expect(findCatalogInconsistencies(snapshot)).toEqual([
      "session session-1 references a location that doesn't exist: location-missing",
    ]);
  });

  it('flags a session with a malformed calendar date', () => {
    const snapshot: CatalogSnapshot = {
      ...validSnapshot,
      sessions: [{ ...session, endDate: '2027-02-30' }],
    };
    expect(findCatalogInconsistencies(snapshot)).toEqual([
      'session session-1: session-1.endDate is not a real date: "2027-02-30"',
    ]);
  });

  it('flags both dates when start and end are both malformed, not just the first', () => {
    const snapshot: CatalogSnapshot = {
      ...validSnapshot,
      sessions: [{ ...session, startDate: '2027-02-30', endDate: '2027-13-01' }],
    };
    expect(findCatalogInconsistencies(snapshot)).toEqual([
      'session session-1: session-1.startDate is not a real date: "2027-02-30"',
      'session session-1: session-1.endDate is not a real date: "2027-13-01"',
    ]);
  });

  it('flags a session whose end date precedes its start date', () => {
    const snapshot: CatalogSnapshot = {
      ...validSnapshot,
      sessions: [{ ...session, startDate: '2027-06-11', endDate: '2027-06-07' }],
    };
    expect(findCatalogInconsistencies(snapshot)).toEqual([
      'session session-1 ends (2027-06-07) before it starts (2027-06-11)',
    ]);
  });

  it('flags a session with a negative priceCents', () => {
    const snapshot: CatalogSnapshot = {
      ...validSnapshot,
      sessions: [{ ...session, priceCents: -100 }],
    };
    expect(findCatalogInconsistencies(snapshot)).toEqual([
      'session session-1 has an invalid priceCents: -100',
    ]);
  });

  it('flags a session with a fractional priceCents', () => {
    const snapshot: CatalogSnapshot = {
      ...validSnapshot,
      sessions: [{ ...session, priceCents: 199.5 }],
    };
    expect(findCatalogInconsistencies(snapshot)).toEqual([
      'session session-1 has an invalid priceCents: 199.5',
    ]);
  });

  it('does not flag a session that simply leaves priceCents unset', () => {
    const snapshot: CatalogSnapshot = {
      ...validSnapshot,
      sessions: [{ ...session, priceCents: undefined }],
    };
    expect(findCatalogInconsistencies(snapshot)).toEqual([]);
  });

  it('reports every violation in one pass rather than stopping at the first', () => {
    const snapshot: CatalogSnapshot = {
      ...validSnapshot,
      camps: [{ ...camp, providerId: 'provider-missing' }],
      sessions: [{ ...session, campId: 'camp-missing', priceCents: -100 }],
    };
    expect(findCatalogInconsistencies(snapshot)).toEqual([
      "camp camp-1 references a provider that doesn't exist: provider-missing",
      "session session-1 references a camp that doesn't exist: camp-missing",
      'session session-1 has an invalid priceCents: -100',
    ]);
  });
});
