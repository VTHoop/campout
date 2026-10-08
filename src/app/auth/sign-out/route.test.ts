import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { POST } from './route';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

const signOut = vi.fn();

describe('POST /auth/sign-out', () => {
  beforeEach(() => {
    signOut.mockReset().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({
      auth: { signOut },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  });

  it('signs the user out and sends them to /', async () => {
    const response = await POST(
      new Request('https://campout.test/auth/sign-out', { method: 'POST' }),
    );

    expect(signOut).toHaveBeenCalledOnce();
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/');
  });

  it('answers 303, so the browser follows the redirect with a GET', async () => {
    const response = await POST(
      new Request('https://campout.test/auth/sign-out', { method: 'POST' }),
    );

    expect(response.status).toBe(303);
  });
});
