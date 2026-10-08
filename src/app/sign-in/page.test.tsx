import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import SignInPage, { metadata } from './page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/browser', () => ({ createClient: vi.fn() }));

const getUser = vi.fn();

async function renderPage(searchParams: Record<string, string | string[] | undefined> = {}) {
  render(await SignInPage({ searchParams: Promise.resolve(searchParams) }));
}

describe('the sign-in page', () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
    getUser.mockReset().mockResolvedValue({ data: { user: null } });
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  });

  it('is titled Sign in', () => {
    expect(metadata.title).toBe('Sign in');
  });

  it('shows the email form to a signed-out visitor', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sends a signed-in user to /', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT /');
  });

  it("says the link didn't work and prompts for a new one", async () => {
    await renderPage({ error: 'link' });

    expect(screen.getByRole('alert')).toHaveTextContent("That link didn't work");
    expect(screen.getByRole('alert')).toHaveTextContent('request a new one');
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('says nothing about a link for any other error value', async () => {
    await renderPage({ error: 'whatever' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
