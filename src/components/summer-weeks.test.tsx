import { weeksBetween } from '@campout/planner';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReadonlyURLSearchParams, useSearchParams } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { approveRecord } from '@/lib/catalog/approve';
import { cardFixture, chainFixture, SUMMER_2026_CARDS } from '@/lib/catalog/session-card-fixtures';
import { VerificationKind } from '@/lib/catalog/session-cards';
import { SummerWeeks } from './summer-weeks';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useSearchParams: vi.fn(),
}));

vi.mock('@/lib/supabase/browser', () => ({ createClient: vi.fn(() => ({})) }));
vi.mock('@/lib/catalog/approve', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/catalog/approve')>()),
  approveRecord: vi.fn(async () => ({ ok: true, on: '2026-10-13' })),
}));

/**
 * The week picker over the selected week's session cards (CAM-32), on invented
 * cards. Summer 2026 is 12 weeks, Monday June 1 to Monday August 17; week 10
 * is the week of August 3. Real navigation — reload, back and forward — is in
 * e2e/session-cards.spec.ts.
 */
const WEEKS = weeksBetween('2026-06-01', '2026-08-21');
const CARDS = SUMMER_2026_CARDS;

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
  let pushState: MockInstance<History['pushState']>;

  beforeEach(() => {
    pushState = vi.spyOn(window.history, 'pushState').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the week the URL names, with its cards by start date then camp name', () => {
    renderAt('summer=2026&week=10');
    expect(tile(10)).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('heading', { level: 2, name: '5 camps, week of Aug 3' }),
    ).toBeInTheDocument();
    expect(campNames()).toEqual([
      'Fixture Baseball Camp',
      'Fixture Swim Camp',
      'Fixture Swim Camp',
      'Fixture Theater Camp',
      'Fixture Chess Club',
    ]);
  });

  it('labels the list of cards with its heading', () => {
    renderAt('week=10');
    expect(screen.getByRole('list', { name: '5 camps, week of Aug 3' })).toBeInTheDocument();
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
      CARDS.filter((card) => card.id === 'baseball'),
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
    expect(pushState).toHaveBeenCalledExactlyOnceWith(null, '', '?summer=2026&week=3');
  });

  it('announces the heading, and only the heading, when the week changes', () => {
    renderAt('week=10');
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('list').closest('[aria-live]')).toBeNull();
  });
});

/**
 * A reviewer approving from a card (CAM-46). Two drafts of one camp, both in week 1,
 * share a provider, location and camp: approving one of those on a card
 * updates the other card without a reload.
 */
describe('SummerWeeks, for a reviewer', () => {
  const DRAFTS = ['a', 'b'].map((id) =>
    cardFixture(id, 'Fixture Camp', '2026-06-01', '2026-06-05', {
      records: chainFixture({ sessionId: id, campName: 'Fixture Camp', drafts: true }),
      verification: { kind: VerificationKind.Draft },
    }),
  );

  /** The first match, or a failure that names it: no indexing, no cast. */
  function firstControl(name: string): HTMLElement {
    const first = screen.getAllByRole('button', { name }).at(0);
    if (first === undefined) throw new Error(`No control named ${name}`);
    return first;
  }

  function renderReviewer(canApprove: boolean) {
    vi.mocked(useSearchParams).mockReturnValue(
      new ReadonlyURLSearchParams(new URLSearchParams('summer=2026&week=1')),
    );
    render(<SummerWeeks weeks={WEEKS} cards={DRAFTS} canApprove={canApprove} />);
  }

  afterEach(() => vi.clearAllMocks());

  it('shows no approve control to a visitor who cannot approve', () => {
    renderReviewer(false);
    expect(screen.queryByRole('button', { name: /^Approve / })).toBeNull();
  });

  it('shows each draft record’s control on each card', () => {
    renderReviewer(true);
    expect(screen.getAllByRole('button', { name: 'Approve camp: Fixture Camp' })).toHaveLength(2);
  });

  it('calls approve_record as the signed-in user, for the one record', async () => {
    renderReviewer(true);
    fireEvent.click(firstControl('Approve camp: Fixture Camp'));
    await waitFor(() => expect(approveRecord).toHaveBeenCalledOnce());
    expect(approveRecord).toHaveBeenCalledWith(expect.anything(), 'camp', 'camp-id', false);
  });

  it('removes a shared record’s control from every card that carries it', async () => {
    renderReviewer(true);
    fireEvent.click(firstControl('Approve camp: Fixture Camp'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Approve camp: Fixture Camp' })).toBeNull(),
    );
    expect(
      screen.getAllByRole('button', { name: 'Approve provider: Fixture Provider' }),
    ).toHaveLength(2);
  });

  it('turns that session’s provenance to Verified on the day, and not the other card’s', async () => {
    renderReviewer(true);
    fireEvent.click(firstControl('Approve session: Fixture Camp'));
    await screen.findByText('Verified Oct 13, 2026');
    expect(screen.getAllByText('Draft · not yet verified')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Approve session: Fixture Camp' })).toHaveLength(
      1,
    );
  });

  it('keeps the record a draft and shows the message when approval is refused', async () => {
    vi.mocked(approveRecord).mockResolvedValueOnce({
      ok: false,
      message: 'approve the camp first',
    });
    renderReviewer(true);
    fireEvent.click(firstControl('Approve session: Fixture Camp'));
    expect(await screen.findByRole('alert')).toHaveTextContent('approve the camp first');
    expect(screen.getAllByText('Draft · not yet verified')).toHaveLength(2);
  });
});
