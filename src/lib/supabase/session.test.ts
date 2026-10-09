import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshSession } from './session';

vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }));

/** The two cookie hooks the client is given; the real type is a union of this and a deprecated shape. */
interface CookieOptions {
  getAll: () => unknown;
  setAll: (cookies: { name: string; value: string; options: object }[]) => unknown;
}

const getClaims = vi.fn();
let cookies: CookieOptions;

function requestWith(cookie?: string) {
  return new NextRequest('https://campout.test/camps', {
    headers: cookie ? { cookie } : {},
  });
}

describe('refreshSession', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    getClaims.mockReset().mockResolvedValue({ data: null, error: null });
    vi.mocked(createServerClient).mockImplementation(((
      _url: string,
      _key: string,
      init: { cookies: CookieOptions },
    ) => {
      cookies = init.cookies;
      return { auth: { getClaims } };
    }) as unknown as typeof createServerClient);
  });

  it('builds its client from the public URL and the publishable key', async () => {
    await refreshSession(requestWith());

    expect(createServerClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'sb_publishable_test',
      expect.anything(),
    );
  });

  it('asks Supabase to check and refresh the session, once', async () => {
    await refreshSession(requestWith());

    expect(getClaims).toHaveBeenCalledOnce();
  });

  it('reads the session from the request cookies', async () => {
    await refreshSession(requestWith('sb-session=abc'));

    expect(await cookies.getAll()).toEqual([{ name: 'sb-session', value: 'abc' }]);
  });

  it('keeps refreshed cookies on the request, for this render, and on the response, for the browser', async () => {
    const request = requestWith('sb-session=old');
    getClaims.mockImplementation(async () => {
      await cookies.setAll([{ name: 'sb-session', value: 'new', options: { path: '/' } }]);
      return { data: null, error: null };
    });

    const response = await refreshSession(request);

    expect(request.cookies.get('sb-session')?.value).toBe('new');
    expect(response.cookies.get('sb-session')?.value).toBe('new');
  });
});
