import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from './server';

vi.mock('server-only', () => ({}));
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

/** The two cookie hooks the client is given; the real type is a union of this and a deprecated shape. */
interface CookieOptions {
  getAll: () => unknown;
  setAll: (cookies: { name: string; value: string; options: object }[]) => unknown;
}

const store = { getAll: vi.fn(), set: vi.fn() };
let options: CookieOptions;

describe('createClient (server)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    store.getAll.mockReset().mockReturnValue([{ name: 'sb', value: '1' }]);
    store.set.mockReset();
    vi.mocked(cookies).mockResolvedValue(store as never);
    vi.mocked(createServerClient).mockImplementation(((
      _url: string,
      _key: string,
      init: { cookies: CookieOptions },
    ) => {
      options = init.cookies;
      return {};
    }) as unknown as typeof createServerClient);
  });

  it('uses the public URL and the publishable key, never a secret key', async () => {
    await createClient();

    expect(createServerClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'sb_publishable_test',
      expect.anything(),
    );
  });

  it("reads the user's session from the request cookies", async () => {
    await createClient();

    expect(await options.getAll()).toEqual([{ name: 'sb', value: '1' }]);
  });

  it('writes refreshed cookies to the cookie store', async () => {
    await createClient();
    await options.setAll([{ name: 'sb', value: '2', options: { path: '/' } }]);

    expect(store.set).toHaveBeenCalledWith('sb', '2', { path: '/' });
  });

  it('ignores the error a Server Component gets when it tries to set a cookie', async () => {
    store.set.mockImplementation(() => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler');
    });
    await createClient();

    await expect(
      Promise.resolve(options.setAll([{ name: 'sb', value: '2', options: {} }])),
    ).resolves.toBeUndefined();
  });
});
