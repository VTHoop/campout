import type { SupabaseClient } from '@supabase/supabase-js';
import type { TestUser } from './helpers';
import { createTestUser, serviceClient } from './helpers';

/**
 * Invented catalog rows for the RLS suite, in the provider → camp → session
 * shape (CAM-27). Each builder takes the ids of the rows it hangs off and any
 * overrides a test needs, so a test states only the one fact it is about.
 *
 * Every row is written as a DRAFT: evidence, but no status and no verified_*.
 * Only approve_record() can make a row verified (ADR-0017 §3); a test that
 * needs a verified row approves it as a reviewer, through approveChain().
 */

export const PROVENANCE = {
  source_url: 'https://example.test/camp/sessions',
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
  ...PROVENANCE,
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
 * Put every row a test may have verified back to draft, so it can be deleted:
 * the guard refuses to delete a verified row (archive, don't delete). A
 * status-only change is allowed outside the gate.
 */
export async function unpublish(
  admin: SupabaseClient,
  providerId: string,
  locationId: string,
): Promise<void> {
  const { data: camps } = await admin.from('camps').select('id').eq('provider_id', providerId);
  const campIds = (camps ?? []).map((camp: { id: string }) => camp.id);
  await admin.from('sessions').update({ status: 'draft' }).in('camp_id', campIds);
  await admin.from('camps').update({ status: 'draft' }).in('id', campIds);
  await admin.from('providers').update({ status: 'draft' }).eq('id', providerId);
  await admin.from('locations').update({ status: 'draft' }).eq('id', locationId);
}

/**
 * Stand up a provider, one of its camps and a location, run the assertion, then
 * remove them. Anything approved goes back to draft first; deleting the
 * provider then cascades to its camps and their sessions and options, which
 * frees the location to be deleted after them.
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
    if (locationId) await unpublish(admin, providerId, locationId);
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

/** A signed-in user listed in `reviewers`, so is_reviewer() is true for their client. */
export async function createReviewer(label: string): Promise<TestUser> {
  const user = await createTestUser(label);
  const { error } = await serviceClient()
    .from('reviewers')
    .insert({ user_id: user.id, display_name: `Reviewer ${label}` });
  if (error) throw new Error(`Could not list ${label} as a reviewer: ${error.message}`);
  return user;
}

/** Approve one row as `reviewer`, failing loudly: setup, not the thing under test. */
export async function approve(
  reviewer: TestUser,
  kind: string,
  id: string,
  confirmLongSpan = false,
): Promise<void> {
  const { error } = await reviewer.client.rpc('approve_record', {
    record_kind: kind,
    record_id: id,
    confirm_long_span: confirmLongSpan,
  });
  if (error) throw new Error(`Could not approve ${kind} ${id}: ${error.message}`);
}

/**
 * Give the session one option, then approve the whole chain in the only order
 * the approval function accepts: provider and location, then the camp, then
 * the session. Returns the option's id.
 */
export async function approveChain(
  reviewer: TestUser,
  ids: SeededSession,
  admin: SupabaseClient,
): Promise<string> {
  const optionId = await insertId(admin, 'session_options', optionRow(ids.sessionId));
  await approve(reviewer, 'provider', ids.providerId);
  await approve(reviewer, 'location', ids.locationId);
  await approve(reviewer, 'camp', ids.campId);
  await approve(reviewer, 'session', ids.sessionId);
  return optionId;
}
