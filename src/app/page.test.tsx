import { redirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';
import RootPage from './page';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

describe('RootPage', () => {
  it('sends the visitor to Summer with a temporary redirect', () => {
    RootPage();
    expect(redirect).toHaveBeenCalledWith('/summer');
  });
});
