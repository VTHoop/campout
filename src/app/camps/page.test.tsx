import { render, screen, within } from '@testing-library/react';
import { ReadonlyURLSearchParams, useSearchParams } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SUMMER_2026_CARDS } from '@/lib/catalog/session-card-fixtures';
import { CampsView } from './camps-view';
import CampsPage, { metadata } from './page';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useSearchParams: vi.fn(),
}));

// The page's job is wiring: a client in, cards out. The real read, and what RLS
// lets each visitor see, are in supabase/tests/session-cards.rls.test.ts.
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(() => Promise.resolve({})) }));
vi.mock('@/lib/catalog/session-cards', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/catalog/session-cards')>()),
  listSessionCards: vi.fn(
    async () => (await import('@/lib/catalog/session-card-fixtures')).SUMMER_2026_CARDS,
  ),
}));

/**
 * The page is drawn from Chesterfield's drafted calendars for 2025-26 through
 * 2027-28 (CAM-31). Summer 2026 runs May 30 – Aug 23, summer 2027 June 5 –
 * Aug 22. Today is passed in, so these hold whatever the date they run on.
 */
const SEPTEMBER_2026 = '2026-09-27';
const CARDS = SUMMER_2026_CARDS;

/** The week picker reads `?week=` from the URL on the client (CAM-32). */
function atUrl(search: string) {
  vi.mocked(useSearchParams).mockReturnValue(
    new ReadonlyURLSearchParams(new URLSearchParams(search)),
  );
}

function renderSummer({
  today = SEPTEMBER_2026,
  requested,
}: {
  today?: string;
  requested?: string | string[];
} = {}) {
  render(<CampsView today={today} requested={requested} cards={CARDS} />);
}

function weekTiles() {
  return screen.getAllByRole('button', { name: /^Week \d+, Monday / });
}

function chooserYears() {
  const chooser = screen.getByRole('navigation', { name: 'Choose a summer' });
  return within(chooser)
    .getAllByRole('link')
    .map((link) => link.textContent);
}

function currentSummer() {
  const chooser = screen.getByRole('navigation', { name: 'Choose a summer' });
  return within(chooser)
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'true')
    .map((link) => link.textContent);
}

describe('CampsPage', () => {
  beforeEach(() => {
    atUrl('');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('titles the browser tab Find camps', () => {
    expect(metadata.title).toBe('Find camps');
  });

  it('renders the summer derived from the planner package', () => {
    renderSummer();
    expect(screen.getByText('Chesterfield, 2027 · 11 weeks')).toBeInTheDocument();
  });

  it('lists every week of summer', () => {
    renderSummer();
    expect(weekTiles()).toHaveLength(11);
  });

  it('introduces the weeks as Your summer', () => {
    renderSummer();
    expect(screen.getByRole('heading', { level: 1, name: 'Your summer' })).toBeInTheDocument();
  });

  it('runs from the week of Monday June 7 to the week of Monday August 16', () => {
    renderSummer();
    const weeks = weekTiles();
    expect(weeks.at(0)).toHaveAccessibleName('Week 1, Monday June 7');
    expect(weeks.at(-1)).toHaveAccessibleName('Week 11, Monday August 16');
  });

  it('has no Browse all camps link and no gap count yet', () => {
    renderSummer();
    expect(screen.queryByRole('link', { name: /browse all camps/i })).toBeNull();
    expect(screen.queryByText(/still have a gap/i)).toBeNull();
  });

  it('offers the summers between loaded school years, and no estimated one', () => {
    renderSummer();
    expect(chooserYears()).toEqual(['2026', '2027']);
  });

  it('defaults to the upcoming summer while school is in session', () => {
    renderSummer();
    expect(currentSummer()).toEqual(['2027']);
  });

  it('defaults to the summer in progress', () => {
    renderSummer({ today: '2027-07-15' });
    expect(currentSummer()).toEqual(['2027']);
    expect(screen.getByText('Chesterfield, 2027 · 11 weeks')).toBeInTheDocument();
  });

  // School is back on Aug 23 2027, and 2028-29 is not loaded: summer 2028 is
  // estimated to end before Monday Aug 21 (ADR-0014).
  it('offers an estimated summer when the upcoming one has no next year loaded', () => {
    renderSummer({ today: '2027-08-23' });
    expect(chooserYears()).toEqual(['2026', '2027', '2028']);
    expect(currentSummer()).toEqual(['2028']);
    expect(screen.getByText('Chesterfield, 2028 · 11 weeks')).toBeInTheDocument();
  });

  it('does not label a summer as estimated in the chooser', () => {
    renderSummer({ today: '2027-08-23' });
    const chooser = screen.getByRole('navigation', { name: 'Choose a summer' });
    expect(within(chooser).queryByText(/estimat/i)).toBeNull();
    expect(within(chooser).getByRole('link', { name: 'Summer 2028' })).toBeInTheDocument();
  });

  it('shows the chosen summer’s weeks', () => {
    renderSummer({ requested: '2026' });
    const weeks = weekTiles();
    expect(weeks).toHaveLength(12);
    expect(weeks.at(0)).toHaveAccessibleName('Week 1, Monday June 1');
    expect(weeks.at(-1)).toHaveAccessibleName('Week 12, Monday August 17');
  });

  it('follows the chosen summer in the caption', () => {
    renderSummer({ requested: '2026' });
    expect(screen.getByText('Chesterfield, 2026 · 12 weeks')).toBeInTheDocument();
    expect(currentSummer()).toEqual(['2026']);
  });

  it.each([
    ['a summer not on offer', '2019'],
    ['an estimated summer while the upcoming one is published', '2028'],
    ['a value that is not a year', 'summer'],
    ['an empty value', ''],
    ['a repeated parameter', ['2026', '2027']],
  ])('falls back to the default silently for %s', (_case, requested) => {
    renderSummer({ requested });
    expect(currentSummer()).toEqual(['2027']);
    expect(screen.getByText('Chesterfield, 2027 · 11 weeks')).toBeInTheDocument();
  });

  it('reads today from the clock in Richmond and the summer from the URL', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-27T16:00:00Z'));

    render(await CampsPage({ searchParams: Promise.resolve({ summer: '2026' }) }));
    expect(screen.getByText('Chesterfield, 2026 · 12 weeks')).toBeInTheDocument();
  });

  it('defaults from the clock when the URL names no summer', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-07-15T16:00:00Z'));

    render(await CampsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText('Chesterfield, 2027 · 11 weeks')).toBeInTheDocument();
  });

  it('shows the selected week’s session cards below the week picker', () => {
    atUrl('summer=2026&week=10');
    renderSummer({ requested: '2026' });
    const picker = screen.getByRole('group', { name: 'Weeks of summer' });
    const heading = screen.getByRole('heading', { level: 2, name: '5 camps, week of Aug 3' });
    expect(picker.compareDocumentPosition(heading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Fixture Baseball Camp' }),
    ).toBeInTheDocument();
  });

  it('lists no camps for a week the catalog has none in', () => {
    // The fixtures are all summer 2026; summer 2027's week 11 has none.
    atUrl('week=11');
    renderSummer();
    expect(
      screen.getByRole('heading', { level: 2, name: 'No camps listed for week 11' }),
    ).toBeInTheDocument();
  });

  it('loads the cards from the session-card service', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-27T16:00:00Z'));
    atUrl('summer=2026&week=10');

    render(await CampsPage({ searchParams: Promise.resolve({ summer: '2026', week: '10' }) }));
    expect(
      screen.getByRole('heading', { level: 2, name: '5 camps, week of Aug 3' }),
    ).toBeInTheDocument();
  });
});
