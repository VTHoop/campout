import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteNav } from './site-nav';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

function renderAt(pathname: string) {
  vi.mocked(usePathname).mockReturnValue(pathname);
  render(<SiteNav />);
}

describe('SiteNav', () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReset();
  });

  it('is a navigation landmark named Main', () => {
    renderAt('/summer');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('links the Campout wordmark to Summer', () => {
    renderAt('/days-off');
    const home = screen.getByRole('link', { name: 'Campout home' });
    expect(home).toHaveAttribute('href', '/summer');
    expect(home).toHaveTextContent('Campout');
  });

  it('links each tab to its page', () => {
    renderAt('/summer');
    expect(screen.getByRole('link', { name: 'Summer' })).toHaveAttribute('href', '/summer');
    expect(screen.getByRole('link', { name: 'Days off' })).toHaveAttribute('href', '/days-off');
  });

  it.each([
    ['/summer', 'Summer', 'Days off'],
    ['/days-off', 'Days off', 'Summer'],
  ])('on %s marks %s as the current page and not %s', (pathname, current, other) => {
    renderAt(pathname);
    expect(screen.getByRole('link', { name: current })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: other })).not.toHaveAttribute('aria-current');
  });

  it('marks no tab current on a page that is neither', () => {
    renderAt('/no-such-page');
    expect(screen.getByRole('link', { name: 'Summer' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Days off' })).not.toHaveAttribute('aria-current');
  });
});
