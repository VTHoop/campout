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

describe('catalog writes are closed to clients', () => {
  it('refuses an anonymous insert', async () => {
    const { error } = await anonClient().from('camps').insert(CAMP);
    expect(error).not.toBeNull();
  });

  it('refuses an anonymous update', async () => {
    const admin = serviceClient();
    const seeded = await admin.from('camps').insert(CAMP).select('id').single();
    expect(seeded.error).toBeNull();
    const id = seeded.data?.id as string;

    try {
      const { error } = await anonClient().from('camps').update({ name: 'Hijacked' }).eq('id', id);
      expect(error).toBeNull(); // no matching row, so no error — the name must be unchanged

      const after = await admin.from('camps').select('name').eq('id', id).single();
      expect(after.data?.name).toBe(CAMP.name);
    } finally {
      await admin.from('camps').delete().eq('id', id);
    }
  });

  it('refuses an anonymous delete', async () => {
    const admin = serviceClient();
    const seeded = await admin.from('camps').insert(CAMP).select('id').single();
    expect(seeded.error).toBeNull();
    const id = seeded.data?.id as string;

    try {
      const { error } = await anonClient().from('camps').delete().eq('id', id);
      expect(error).toBeNull();

      const after = await admin.from('camps').select('id').eq('id', id);
      expect(after.data).toEqual([{ id }]);
    } finally {
      await admin.from('camps').delete().eq('id', id);
    }
  });
});

describe('the schema refuses records that break its own rules', () => {
  it('rejects a camp with no provenance', async () => {
    const admin = serviceClient();
    const { error } = await admin
      .from('camps')
      .insert({ name: 'No Source', website_url: 'https://example.test' });

    // source_url, verified_at and verified_by are NOT NULL: a record that cannot
    // be traced back to a page a human checked must not exist at all.
    expect(error).not.toBeNull();
  });
});
