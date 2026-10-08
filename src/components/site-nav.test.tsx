import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteNav } from './site-nav';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

function renderAt(pathname: string, signedIn = false) {
  vi.mocked(usePathname).mockReturnValue(pathname);
  render(<SiteNav signedIn={signedIn} />);
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
    expect(screen.getByRole('link', { name: 'Find camps' })).toHaveAttribute('href', '/camps');
  });

  it('orders the tabs Summer, Days off, Find camps', () => {
    renderAt('/summer');
    const tabs = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(tabs).toEqual(['Summer', 'Days off', 'Find camps']);
  });

  it.each([
    ['/summer', 'Summer', 'Days off'],
    ['/days-off', 'Days off', 'Summer'],
    ['/camps', 'Find camps', 'Days off'],
  ])('on %s marks %s as the current page and not %s', (pathname, current, other) => {
    renderAt(pathname);
    expect(screen.getByRole('link', { name: current })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: other })).not.toHaveAttribute('aria-current');
  });

  it('marks no tab current on a page that is neither', () => {
    renderAt('/no-such-page');
    expect(screen.getByRole('link', { name: 'Summer' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Days off' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Find camps' })).not.toHaveAttribute('aria-current');
  });

  it('shows no auth controls to a signed-out visitor', () => {
    renderAt('/summer');
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('shows a Sign out button to a signed-in user, which posts to the sign-out route', () => {
    renderAt('/summer', true);
    const button = screen.getByRole('button', { name: 'Sign out' });
    const form = button.closest('form');
    expect(form).toHaveAttribute('action', '/auth/sign-out');
    expect(form).toHaveAttribute('method', 'post');
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('keeps the tabs the same for a signed-in user', () => {
    renderAt('/summer', true);
    const tabs = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(tabs).toEqual(['Summer', 'Days off', 'Find camps']);
  });
});
