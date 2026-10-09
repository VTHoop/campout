import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { refreshSession } from '@/lib/supabase/session';
import { config, proxy } from './proxy';

vi.mock('@/lib/supabase/session', () => ({ refreshSession: vi.fn() }));

function runsOn(path: string) {
  return config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(path));
}

describe('proxy', () => {
  it('hands the request to the session refresh and returns its response', async () => {
    const response = new Response();
    vi.mocked(refreshSession).mockResolvedValue(response as never);
    const request = new NextRequest('https://campout.test/camps');

    expect(await proxy(request)).toBe(response);
    expect(refreshSession).toHaveBeenCalledWith(request);
  });

  it.each(['/camps', '/summer', '/sign-in', '/'])('runs on the page %s', (path) => {
    expect(runsOn(path)).toBe(true);
  });

  it.each([
    '/_next/static/chunks/app.js',
    '/_next/image',
    '/favicon.ico',
    '/logo.svg',
    '/auth/callback',
    '/auth/sign-out',
  ])('stays out of the way of %s', (path) => {
    expect(runsOn(path)).toBe(false);
  });
});
