import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * localKeys() env-var override (CAM-25).
 *
 * The RLS suite otherwise only ever talks to local Docker via `supabase status`.
 * These pin the second path: pointing the same suite at a live project by
 * setting SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY, so
 * "pass against the live project, not just local Docker" is something you can
 * actually run, not just claim.
 */
describe('localKeys', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.doUnmock('node:child_process');
  });

  it('prefers SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY env vars over the local CLI status', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_example';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_example';

    const { localKeys } = await import('./helpers');

    expect(localKeys()).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_example',
      secretKey: 'sb_secret_example',
    });
  });

  it('falls back to `supabase status` when no env vars are set', async () => {
    vi.doMock('node:child_process', () => ({
      execFileSync: vi.fn(() =>
        JSON.stringify({
          API_URL: 'http://127.0.0.1:54321',
          ANON_KEY: 'local-anon',
          SERVICE_ROLE_KEY: 'local-service-role',
        }),
      ),
    }));

    const { localKeys } = await import('./helpers');

    expect(localKeys()).toEqual({
      url: 'http://127.0.0.1:54321',
      publishableKey: 'local-anon',
      secretKey: 'local-service-role',
    });
  });

  it('falls back to `supabase status` when only some env vars are set', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    // PUBLISHABLE_KEY and SECRET_KEY are deliberately left unset — a half-set
    // override must not silently mix a remote URL with local keys.

    vi.doMock('node:child_process', () => ({
      execFileSync: vi.fn(() =>
        JSON.stringify({
          API_URL: 'http://127.0.0.1:54321',
          ANON_KEY: 'local-anon',
          SERVICE_ROLE_KEY: 'local-service-role',
        }),
      ),
    }));

    const { localKeys } = await import('./helpers');

    expect(localKeys()).toEqual({
      url: 'http://127.0.0.1:54321',
      publishableKey: 'local-anon',
      secretKey: 'local-service-role',
    });
  });
});
