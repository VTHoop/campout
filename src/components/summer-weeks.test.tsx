import { weeksBetween } from '@campout/planner';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ReadonlyURLSearchParams, useSearchParams } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listSessionCards } from '@/lib/catalog/session-cards';
import { SummerWeeks } from './summer-weeks';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useSearchParams: vi.fn(),
}));

/**
 * The week picker over the selected week's session cards (CAM-32), on the mock
 * catalog. Summer 2026 is 12 weeks, Monday June 1 to Monday August 17; week 10
 * is the week of August 3. Real navigation — reload, back and forward — is in
 * e2e/session-cards.spec.ts.
 */
const WEEKS = weeksBetween('2026-06-01', '2026-08-21');
const CARDS = await listSessionCards();

function renderAt(search: string, cards = CARDS) {
  vi.mocked(useSearchParams).mockReturnValue(
    new ReadonlyURLSearchParams(new URLSearchParams(search)),
  );
  render(<SummerWeeks weeks={WEEKS} cards={cards} />);
}

function tile(number: number) {
  return screen.getByRole('button', { name: (name) => name.startsWith(`Week ${number}, `) });
}

function campNames() {
  return within(screen.getByRole('list'))
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent);
}

describe('SummerWeeks', () => {
  beforeEach(() => {
    vi.spyOn(window.history, 'pushState').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the week the URL names, with its cards by start date then camp name', () => {
    renderAt('summer=2026&week=10');
    expect(tile(10)).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('heading', { level: 2, name: '3 camps, week of Aug 3' }),
    ).toBeInTheDocument();
    expect(campNames()).toEqual([
      'Game On!',
      'Junior Mini Tennis Camp',
      'VCU Baseball Summer Youth Camps',
    ]);
  });

  it('labels the list of cards with its heading', () => {
    renderAt('week=10');
    expect(screen.getByRole('list', { name: '3 camps, week of Aug 3' })).toBeInTheDocument();
  });

  it('gives each card its week number', () => {
    renderAt('week=10');
    expect(screen.getByText('Week 10, August 3 to 5, Monday to Wednesday')).toBeInTheDocument();
  });

  it('shows week 1 when the URL names no week', () => {
    renderAt('summer=2026');
    expect(tile(1)).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('heading', { level: 2, name: '2 camps, week of Jun 1' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['non-numeric', 'week=ten'],
    ['zero', 'week=0'],
    ['past the last week', 'week=13'],
  ])('shows week 1 when the week is %s', (_case, search) => {
    renderAt(search);
    expect(tile(1)).toHaveAttribute('aria-pressed', 'true');
  });

  it('counts a single camp as one camp', () => {
    renderAt(
      'week=10',
      CARDS.filter((card) => card.id === 'session-vcu-ironbridge'),
    );
    expect(
      screen.getByRole('heading', { level: 2, name: '1 camp, week of Aug 3' }),
    ).toBeInTheDocument();
  });

  it('says so, instead of an empty list, for a week with no sessions', () => {
    renderAt('week=4', []);
    expect(
      screen.getByRole('heading', { level: 2, name: 'No camps listed for week 4' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('puts the chosen week in the URL, keeping the summer', () => {
    renderAt('summer=2026');
    fireEvent.click(tile(3));
    expect(window.history.pushState).toHaveBeenCalledExactlyOnceWith(
      null,
      '',
      '?summer=2026&week=3',
    );
  });

  it('announces the heading, and only the heading, when the week changes', () => {
    renderAt('week=10');
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('list').closest('[aria-live]')).toBeNull();
  });
});
