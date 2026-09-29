import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './helpers';

/**
 * Invented catalog rows for the RLS suite, in the provider → camp → session
 * shape (CAM-27). Each builder takes the ids of the rows it hangs off and any
 * overrides a test needs, so a test states only the one fact it is about.
 */

export const PROVENANCE = {
  source_url: 'https://example.test/camp/sessions',
  verified_at: '2026-09-01T00:00:00Z',
  verified_by: 'rls-suite',
};

export const PROVIDER = {
  name: 'Fixture Rec League',
  website_url: 'https://example.test',
  ...PROVENANCE,
};

export const LOCATION = {
  label: 'Fixture Community Center',
  street: '100 Test Way',
  city: 'Richmond',
  postal_code: '23220',
  point: 'SRID=4326;POINT(-77.4360 37.5407)',
};

export function campRow(providerId: string, overrides: Record<string, unknown> = {}) {
  return {
    provider_id: providerId,
    name: 'Fixture Day Camp',
    categories: ['day_camp'],
    registration_url: 'https://example.test/camp/register',
    ...PROVENANCE,
    ...overrides,
  };
}

export function sessionRow(
  campId: string,
  locationId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    camp_id: campId,
    location_id: locationId,
    start_date: '2027-07-12',
    end_date: '2027-07-16',
    ...PROVENANCE,
    ...overrides,
  };
}

export function optionRow(sessionId: string, overrides: Record<string, unknown> = {}) {
  return { session_id: sessionId, kind: 'full_day', price_cents: 32500, ...overrides };
}

/** Insert one row as the service role and return its id, failing loudly if setup did not land. */
export async function insertId(
  admin: SupabaseClient,
  table: string,
  row: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await admin.from(table).insert(row).select('id').single();
  if (error) throw new Error(`Could not seed ${table}: ${error.message}`);
  return (data as { id: string }).id;
}

export interface SeededCamp {
  providerId: string;
  campId: string;
  locationId: string;
}

/**
 * Stand up a provider, one of its camps and a location, run the assertion, then
 * remove them. Deleting the provider cascades to its camps and their sessions
 * and options, which frees the location to be deleted after them.
 */
export async function withCampAndLocation(
  assert: (ids: SeededCamp, admin: SupabaseClient) => Promise<void>,
): Promise<void> {
  const admin = serviceClient();
  const providerId = await insertId(admin, 'providers', PROVIDER);
  let locationId: string | undefined;

  try {
    const campId = await insertId(admin, 'camps', campRow(providerId));
    locationId = await insertId(admin, 'locations', LOCATION);
    await assert({ providerId, campId, locationId }, admin);
  } finally {
    await admin.from('providers').delete().eq('id', providerId);
    if (locationId) await admin.from('locations').delete().eq('id', locationId);
  }
}

export interface SeededSession extends SeededCamp {
  sessionId: string;
}

/** As withCampAndLocation, plus one session of the camp at the location. */
export async function withSeededSession(
  assert: (ids: SeededSession, admin: SupabaseClient) => Promise<void>,
): Promise<void> {
  await withCampAndLocation(async (ids, admin) => {
    const sessionId = await insertId(admin, 'sessions', sessionRow(ids.campId, ids.locationId));
    await assert({ ...ids, sessionId }, admin);
  });
}
