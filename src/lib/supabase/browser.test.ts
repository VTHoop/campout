import { createBrowserClient } from '@supabase/ssr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from './browser';

vi.mock('@supabase/ssr', () => ({ createBrowserClient: vi.fn() }));

describe('createClient (browser)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  });

  it('uses the public URL and the publishable key only', () => {
    createClient();

    expect(createBrowserClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'sb_publishable_test',
    );
  });
});
