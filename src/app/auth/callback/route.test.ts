import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { GET } from './route';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

const exchangeCodeForSession = vi.fn();

async function callback(search: string) {
  const response = await GET(new Request(`https://campout.test/auth/callback${search}`));
  return new URL(response.headers.get('location') ?? '');
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({
      auth: { exchangeCodeForSession },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  });

  it('completes the sign-in and returns to the page the user came from', async () => {
    const to = await callback('?code=abc&next=%2Fcamps%3Fweek%3D3');

    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(to.origin).toBe('https://campout.test');
    expect(to.pathname + to.search).toBe('/camps?week=3');
  });

  it.each([
    ['a full URL', '?code=abc&next=https%3A%2F%2Fevil.example'],
    ['a //host path', '?code=abc&next=%2F%2Fevil.example'],
    ['a missing value', '?code=abc'],
  ])('sends the user to / for %s', async (_label, search) => {
    const to = await callback(search);

    expect(to.origin).toBe('https://campout.test');
    expect(to.pathname).toBe('/');
  });

  it('sends the user to /sign-in when the link is expired, used or invalid', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'Token has expired' } });

    const to = await callback('?code=stale&next=%2Fcamps');

    expect(to.pathname).toBe('/sign-in');
    expect(to.searchParams.get('error')).toBe('link');
  });

  it('sends the user to /sign-in when there is no code, without calling Supabase', async () => {
    const to = await callback('?next=%2Fcamps');

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(to.pathname).toBe('/sign-in');
    expect(to.searchParams.get('error')).toBe('link');
  });

  it('sends the user to /sign-in when Supabase reports the link as expired', async () => {
    const to = await callback('?error=access_denied&error_code=otp_expired');

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(to.pathname).toBe('/sign-in');
    expect(to.searchParams.get('error')).toBe('link');
  });

  it('returns to the host the user is on, not the one the server believes it has', async () => {
    const response = await GET(
      new Request('http://localhost:3000/auth/callback?code=abc&next=%2Fcamps', {
        headers: { host: '127.0.0.1:3000' },
      }),
    );

    expect(response.headers.get('location')).toBe('http://127.0.0.1:3000/camps');
  });
});
