import { redirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';
import RootPage from './page';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

describe('RootPage', () => {
  // `redirect` answers 307, not 308: Home will claim `/` later, and browsers
  // cache a permanent redirect.
  it('sends the visitor to Summer with a temporary redirect', () => {
    RootPage();
    expect(redirect).toHaveBeenCalledWith('/summer');
  });
});
