import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { anonClient, serviceClient } from './helpers';

/**
 * Catalog RLS (ADR-0004).
 *
 * The catalog is the public half: world-readable, writable only by the service
 * role. RLS is enabled on these tables anyway, so the permissive read is an
 * explicit policy somebody reviewed rather than an absence nobody noticed.
 *
 * What these tests pin is the *write* side. No insert, update, or delete policy
 * exists, so a normal client cannot change the catalog at all — which is what
 * makes "every record is verified by a human before it goes live" true in the
 * database rather than only in the terms.
 */

const CAMP = {
  name: 'Fixture Day Camp',
  website_url: 'https://example.test/camp',
  source_url: 'https://example.test/camp/sessions',
  verified_at: '2026-09-01T00:00:00Z',
  verified_by: 'rls-suite',
};

/** A camp with no web presence at all — the case the schema used to reject. */
const FLYER_ONLY_CAMP = {
  name: 'Parish Hall Soccer Week',
  source_document_path: 'camp-sources/parish-hall-flyer.jpg',
  verified_at: '2026-09-01T00:00:00Z',
  verified_by: 'rls-suite',
};

describe('catalog reads', () => {
  it('lets an anonymous visitor read camps', async () => {
    const { error } = await anonClient().from('camps').select('id').limit(1);
    expect(error).toBeNull();
  });

  it('lets an anonymous visitor read sessions', async () => {
    const { error } = await anonClient().from('sessions').select('id').limit(1);
    expect(error).toBeNull();
  });

  it('lets an anonymous visitor read school calendars', async () => {
    const { error } = await anonClient().from('school_calendars').select('district').limit(1);
    expect(error).toBeNull();
  });
});

/**
 * Seed a camp as the service role, run an assertion against it, then remove it.
 *
 * The cleanup is in a `finally` so a failing assertion still leaves the table as
 * it found it — otherwise one bad run poisons every later one.
 */
async function withSeededCamp(
  assert: (campId: string, admin: SupabaseClient) => Promise<void>,
): Promise<void> {
  const admin = serviceClient();
  const seeded = await admin.from('camps').insert(CAMP).select('id').single();
  expect(seeded.error).toBeNull();
  const campId = seeded.data?.id as string;

  try {
    await assert(campId, admin);
  } finally {
    await admin.from('camps').delete().eq('id', campId);
  }
}

describe('catalog writes are closed to clients', () => {
  it('refuses an anonymous insert', async () => {
    const { error } = await anonClient().from('camps').insert(CAMP);
    expect(error).not.toBeNull();
  });

  // Update and delete share one assertion because they share one rule: a client
  // write against the catalog matches no rows, so it reports no error and changes
  // nothing. Checking the error alone would pass even if the write had landed —
  // the record has to be read back.
  it.each([
    [
      'update',
      (campId: string) => anonClient().from('camps').update({ name: 'Hijacked' }).eq('id', campId),
    ],
    ['delete', (campId: string) => anonClient().from('camps').delete().eq('id', campId)],
  ])('leaves the record untouched after an anonymous %s', async (_verb, attempt) => {
    await withSeededCamp(async (campId, admin) => {
      const { error } = await attempt(campId);
      expect(error).toBeNull();

      const after = await admin.from('camps').select('id, name').eq('id', campId);
      expect(after.data).toEqual([{ id: campId, name: CAMP.name }]);
    });
  });
});

describe('provenance is required, but need not be a URL', () => {
  it('accepts a camp with no website and no source URL, evidenced by a stored document', async () => {
    const admin = serviceClient();
    const seeded = await admin.from('camps').insert(FLYER_ONLY_CAMP).select('id').single();

    try {
      expect(seeded.error).toBeNull();
      expect(seeded.data?.id).toBeTruthy();
    } finally {
      if (seeded.data?.id) await admin.from('camps').delete().eq('id', seeded.data.id);
    }
  });

  it('rejects a camp with neither a source URL nor a stored document', async () => {
    const { error } = await serviceClient().from('camps').insert({
      name: 'Unevidenced',
      verified_at: '2026-09-01T00:00:00Z',
      verified_by: 'rls-suite',
    });

    // A claim with nothing behind it is not evidence. The check constraint makes
    // that a shape rule rather than a habit somebody has to keep.
    expect(error).not.toBeNull();
  });

  it('rejects a camp with no verifier, however good its source', async () => {
    const { error } = await serviceClient()
      .from('camps')
      .insert({ name: 'Unverified', source_url: 'https://example.test/camp' });

    expect(error).not.toBeNull();
  });
});
