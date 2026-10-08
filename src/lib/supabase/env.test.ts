import { afterEach, describe, expect, it, vi } from 'vitest';
import { supabaseEnv } from './env';

describe('supabaseEnv', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns the URL and the publishable key', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');

    expect(supabaseEnv()).toEqual({
      url: 'http://127.0.0.1:54321',
      publishableKey: 'sb_publishable_test',
    });
  });

  it.each([
    ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
    ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL'],
  ])('refuses to start without %s, and says which one', (missing, present) => {
    vi.stubEnv(present, 'set');
    vi.stubEnv(missing, '');

    expect(() => supabaseEnv()).toThrow(`${missing} is not set`);
  });
});
