import { describe, expect, it } from 'vitest';
import { campPlan, locationPlan, PAGE, providerPlan, sessionPlan } from './intake-fixtures';
import {
  addressKey,
  campRow,
  evidenceColumns,
  locationRow,
  optionRows,
  providerRow,
  sessionRow,
} from './plan';

const FLYER = { documentPath: 'intake-flyer-2027.jpg' } as const;

describe('evidenceColumns', () => {
  it('carries a page as source_url and no document', () => {
    expect(evidenceColumns(PAGE)).toEqual({
      source_url: 'https://example.test/intake/camps',
      source_document_path: null,
    });
  });

  it('carries a stored document as source_document_path and no URL', () => {
    expect(evidenceColumns(FLYER)).toEqual({
      source_url: null,
      source_document_path: 'intake-flyer-2027.jpg',
    });
  });
});

describe('every row built from the plan carries its own source', () => {
  it('a provider', () => {
    expect(providerRow(providerPlan('A', { source: FLYER }))).toEqual({
      name: 'Intake League A',
      website_url: 'https://example.test',
      source_url: null,
      source_document_path: 'intake-flyer-2027.jpg',
    });
  });

  it('a location, with its point built from the coordinates, longitude first', () => {
    expect(locationRow(locationPlan('A'))).toEqual({
      label: 'Intake Center A',
      street: '100 A Way',
      city: 'Richmond',
      state: 'VA',
      postal_code: '23220',
      point: 'SRID=4326;POINT(-77.436 37.5407)',
      source_url: PAGE.url,
      source_document_path: null,
    });
  });

  it('a location with no coordinates yet, as a null point for the database to refuse', () => {
    expect(locationRow(locationPlan('A', { coordinates: null })).point).toBeNull();
  });

  it('a camp, under its provider, with its details facts', () => {
    const camp = campPlan('A', {
      source: FLYER,
      facts: {
        name: 'Intake Swim Camp',
        categories: ['sports'],
        registration_note: 'Call the front desk',
        details: { activities: ['swimming'] },
      },
    });
    expect(campRow(camp, 'provider-id')).toEqual({
      provider_id: 'provider-id',
      name: 'Intake Swim Camp',
      categories: ['sports'],
      registration_note: 'Call the front desk',
      details: { activities: ['swimming'] },
      source_url: null,
      source_document_path: 'intake-flyer-2027.jpg',
    });
  });

  it('a session, under its camp at its location, with its details facts', () => {
    const session = sessionPlan({
      facts: {
        start_date: '2027-07-12',
        end_date: '2027-07-16',
        theme: 'Space Week',
        details: { field_trips: [{ destination: 'Science Museum' }] },
      },
    });
    expect(sessionRow(session, 'camp-id', 'location-id')).toEqual({
      camp_id: 'camp-id',
      location_id: 'location-id',
      start_date: '2027-07-12',
      end_date: '2027-07-16',
      theme: 'Space Week',
      details: { field_trips: [{ destination: 'Science Museum' }] },
      source_url: PAGE.url,
      source_document_path: null,
    });
  });
});

describe('optionRows', () => {
  it('builds one row per option, each under the session', () => {
    const session = sessionPlan({
      options: [
        { kind: 'morning', price_cents: 20000, daily_start: '09:00', daily_end: '12:00' },
        { kind: 'afternoon', price_cents: 18000, details: { daily_rate: { price_cents: 4000 } } },
      ],
    });
    expect(optionRows(session, 'session-id')).toEqual([
      {
        session_id: 'session-id',
        kind: 'morning',
        price_cents: 20000,
        daily_start: '09:00',
        daily_end: '12:00',
      },
      {
        session_id: 'session-id',
        kind: 'afternoon',
        price_cents: 18000,
        details: { daily_rate: { price_cents: 4000 } },
      },
    ]);
  });
});

describe('addressKey', () => {
  it('lower-cases street and postal code, and collapses every run of other characters to one space', () => {
    expect(addressKey('100 Test Way, Suite #4', '23220-1234')).toBe(
      '100 test way suite 4 23220 1234',
    );
  });

  it('trims what punctuation leaves at either end', () => {
    expect(addressKey('  #12 Main St.', '23220.')).toBe('12 main st 23220');
  });
});
