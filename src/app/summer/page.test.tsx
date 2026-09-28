import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SummerPage, { metadata } from './page';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

/**
 * /summer becomes the family's summer plan (CAM-11); the camp finder that used
 * to live here moved to /camps (CAM-35). Until the plan is built, the page is a
 * placeholder, and a link made for the finder is sent on to it.
 */
async function renderAt(searchParams: Record<string, string | string[] | undefined>) {
  render(await SummerPage({ searchParams: Promise.resolve(searchParams) }));
}

describe('SummerPage', () => {
  beforeEach(() => {
    vi.mocked(redirect).mockReset();
  });

  it('titles the browser tab Summer', () => {
    expect(metadata.title).toBe('Summer');
  });

  it('is headed Summer', async () => {
    await renderAt({});
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Summer');
  });

  it('shows placeholder text until the summer plan lands', async () => {
    await renderAt({});
    expect(screen.getByText('You are on the Summer page.')).toBeInTheDocument();
  });

  it('does not redirect a plain visit', async () => {
    await renderAt({});
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    [{ week: '3' }, '/camps?week=3'],
    [{ summer: '2026' }, '/camps?summer=2026'],
    [{ summer: '2026', week: '10' }, '/camps?summer=2026&week=10'],
  ])('sends a finder link, %o, on to %s', async (searchParams, destination) => {
    await renderAt(searchParams);
    expect(redirect).toHaveBeenCalledWith(destination);
  });
});
