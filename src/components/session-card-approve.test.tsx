import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApproveResult } from '@/lib/catalog/approve';
import { cardFixture, chainFixture } from '@/lib/catalog/session-card-fixtures';
import { type SessionCardView, VerificationKind } from '@/lib/catalog/session-cards';
import { RecordKind } from '@/lib/catalog/types';
import { SessionCard } from './session-card';

/**
 * Approving from the card (CAM-46). The card is presentational: it asks
 * `onApprove` and shows what comes back. The parent owns the updated records
 * (summer-weeks.test.tsx), and the database owns every refusal (RLS suite).
 * Focus trapping and Escape are the browser's; e2e/approve.spec.ts covers them.
 */

const OK: ApproveResult = { ok: true, on: '2026-10-13' };

/** jsdom has no modal dialog; this stands in for `showModal()` and `close()`. */
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

afterEach(() => vi.restoreAllMocks());

function draftCard(overrides: Partial<SessionCardView> = {}): SessionCardView {
  return cardFixture('s1', 'Fixture Day Camp', '2026-06-08', '2026-06-12', {
    records: chainFixture({ sessionId: 's1', campName: 'Fixture Day Camp', drafts: true }),
    verification: { kind: VerificationKind.Draft },
    ...overrides,
  });
}

function renderCard(
  card: SessionCardView,
  onApprove?: (kind: RecordKind, id: string, confirm: boolean) => Promise<ApproveResult>,
) {
  render(
    <ul>
      <SessionCard card={card} weekNumber={2} onApprove={onApprove} />
    </ul>,
  );
  return screen.getByRole('listitem');
}

function control(name: string) {
  return screen.getByRole('button', { name });
}

describe('approve controls', () => {
  it('names each draft record by kind and name', () => {
    renderCard(draftCard(), vi.fn());
    for (const name of [
      'Approve provider: Fixture Provider',
      'Approve location: Fixture Park',
      'Approve camp: Fixture Day Camp',
      'Approve session: Fixture Day Camp',
    ]) {
      expect(control(name)).toBeInTheDocument();
    }
  });

  it('lists the chain from the top down: provider, location, camp, session', () => {
    renderCard(draftCard(), vi.fn());
    const kinds = screen
      .getAllByRole('button', { name: /^Approve / })
      .map((button) => button.getAttribute('aria-label')?.split(':')[0]);
    expect(kinds).toEqual([
      'Approve provider',
      'Approve location',
      'Approve camp',
      'Approve session',
    ]);
  });

  it('shows none for a record that is already verified', () => {
    const records = chainFixture({
      sessionId: 's1',
      campName: 'Fixture Day Camp',
      drafts: true,
    }).map((record) =>
      record.kind === RecordKind.Provider ? { ...record, isDraft: false } : record,
    );
    renderCard(draftCard({ records }), vi.fn());
    expect(screen.queryByRole('button', { name: /^Approve provider/ })).toBeNull();
    expect(control('Approve camp: Fixture Day Camp')).toBeInTheDocument();
  });

  it('shows none at all on a verified card', () => {
    renderCard(cardFixture('v1', 'Fixture Day Camp', '2026-06-08', '2026-06-12'), vi.fn());
    expect(screen.queryByRole('button', { name: /^Approve / })).toBeNull();
  });

  it('shows none to a visitor who cannot approve, even on a draft', () => {
    renderCard(draftCard());
    expect(screen.queryByRole('button', { name: /^Approve / })).toBeNull();
  });
});

describe('approving', () => {
  it('approves only the record whose control was used', () => {
    const onApprove = vi.fn(async () => OK);
    renderCard(draftCard(), onApprove);
    fireEvent.click(control('Approve camp: Fixture Day Camp'));
    expect(onApprove).toHaveBeenCalledExactlyOnceWith(RecordKind.Camp, 'camp-id', false);
  });

  it('disables the control and says "Approving…" while in flight, and sends once', async () => {
    let settle: (result: ApproveResult) => void = () => {};
    const onApprove = vi.fn(() => new Promise<ApproveResult>((resolve) => (settle = resolve)));
    renderCard(draftCard(), onApprove);
    fireEvent.click(control('Approve camp: Fixture Day Camp'));

    const working = control('Approve camp: Fixture Day Camp');
    expect(working).toBeDisabled();
    expect(working).toHaveTextContent('Approving…');
    fireEvent.click(working);
    expect(onApprove).toHaveBeenCalledOnce();

    await act(async () => settle(OK));
  });

  it("shows the function's message beside the refused control, and re-enables it", async () => {
    const message = "approve the session's camp, provider and location first";
    const onApprove = vi.fn(async (): Promise<ApproveResult> => ({ ok: false, message }));
    renderCard(draftCard(), onApprove);
    await act(async () => {
      fireEvent.click(control('Approve session: Fixture Day Camp'));
    });

    const refused = control('Approve session: Fixture Day Camp');
    expect(refused).toBeEnabled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(refused.parentElement).toContainElement(alert);
  });

  it('clears the message when the next attempt starts', async () => {
    const onApprove = vi
      .fn<() => Promise<ApproveResult>>()
      .mockResolvedValueOnce({ ok: false, message: 'refused once' })
      .mockResolvedValueOnce(OK);
    renderCard(draftCard(), onApprove);
    await act(async () => {
      fireEvent.click(control('Approve camp: Fixture Day Camp'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('refused once');
    await act(async () => {
      fireEvent.click(control('Approve camp: Fixture Day Camp'));
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('a session that spans more than 14 days', () => {
  const LONG = () =>
    draftCard({
      endDate: '2026-06-22', // June 8 – 22 is 15 days
    });

  it('asks first, naming the span, and sends nothing yet', () => {
    const onApprove = vi.fn(async () => OK);
    renderCard(LONG(), onApprove);
    fireEvent.click(control('Approve session: Fixture Day Camp'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('15 days');
    expect(onApprove).not.toHaveBeenCalled();
  });

  it('approves with confirm_long_span only once confirmed', async () => {
    const onApprove = vi.fn(async () => OK);
    renderCard(LONG(), onApprove);
    fireEvent.click(control('Approve session: Fixture Day Camp'));
    await act(async () =>
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' })),
    );
    expect(onApprove).toHaveBeenCalledExactlyOnceWith(RecordKind.Session, 's1', true);
  });

  it('leaves the session a draft and calls nothing when cancelled', () => {
    const onApprove = vi.fn(async () => OK);
    renderCard(LONG(), onApprove);
    fireEvent.click(control('Approve session: Fixture Day Camp'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onApprove).not.toHaveBeenCalled();
    expect(control('Approve session: Fixture Day Camp')).toBeEnabled();
  });

  it('returns focus to the control that opened it when cancelled', () => {
    renderCard(LONG(), vi.fn());
    const opener = control('Approve session: Fixture Day Camp');
    opener.focus();
    fireEvent.click(opener);
    // The browser moves focus into the modal; jsdom does not, so do it here.
    const cancel = within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' });
    cancel.focus();
    fireEvent.click(cancel);
    expect(opener).toHaveFocus();
  });

  it('does not ask at exactly 14 days', () => {
    const onApprove = vi.fn(async () => OK);
    renderCard(draftCard({ endDate: '2026-06-21' }), onApprove); // 14 days
    fireEvent.click(control('Approve session: Fixture Day Camp'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onApprove).toHaveBeenCalledExactlyOnceWith(RecordKind.Session, 's1', false);
  });

  it('does not ask for a camp, whatever the session spans', () => {
    const onApprove = vi.fn(async () => OK);
    renderCard(LONG(), onApprove);
    fireEvent.click(control('Approve camp: Fixture Day Camp'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onApprove).toHaveBeenCalledOnce();
  });
});

/** What Chromium does when the focused button is disabled: focus falls to the body. */
function dropFocus() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

describe('when an approval does not go through', () => {
  it('puts focus back on the control after a refusal', async () => {
    const onApprove = vi.fn(async (): Promise<ApproveResult> => {
      dropFocus();
      return { ok: false, message: 'approve the camp first' };
    });
    renderCard(draftCard(), onApprove);
    const button = control('Approve session: Fixture Day Camp');
    button.focus();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(control('Approve session: Fixture Day Camp')).toHaveFocus();
  });

  it('re-enables the control and shows the failure when the call itself throws', async () => {
    const onApprove = vi.fn(async (): Promise<ApproveResult> => {
      throw new Error('Could not read camp camp-id back: permission denied');
    });
    renderCard(draftCard(), onApprove);
    await act(async () => {
      fireEvent.click(control('Approve camp: Fixture Day Camp'));
    });
    expect(control('Approve camp: Fixture Day Camp')).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent('permission denied');
  });
});

describe('two cards that each ask first', () => {
  it('give each dialog its own heading and its own span', () => {
    render(
      <ul>
        {[
          ['s1', '2026-06-22'], // 15 days
          ['s2', '2026-06-28'], // 21 days
        ].map(([id, end]) => (
          <SessionCard
            key={id}
            weekNumber={2}
            onApprove={vi.fn(async () => OK)}
            card={cardFixture(id ?? '', `Fixture Camp ${id}`, '2026-06-08', end ?? '', {
              records: chainFixture({
                sessionId: id ?? '',
                campName: `Fixture Camp ${id}`,
                drafts: true,
              }),
              verification: { kind: VerificationKind.Draft },
            })}
          />
        ))}
      </ul>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve session: Fixture Camp s1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve session: Fixture Camp s2' }));
    expect(screen.getByRole('dialog', { name: 'This session runs 15 days' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'This session runs 21 days' })).toBeInTheDocument();
  });
});

describe('after approval', () => {
  it('moves focus to the card when the approved control disappears', async () => {
    const card = draftCard();
    const onApprove = vi.fn(async () => OK);
    const { rerender } = render(
      <ul>
        <SessionCard card={card} weekNumber={2} onApprove={onApprove} />
      </ul>,
    );
    const button = control('Approve camp: Fixture Day Camp');
    button.focus();
    await act(async () => {
      fireEvent.click(button);
    });
    rerender(
      <ul>
        <SessionCard
          card={{
            ...card,
            records: card.records.map((record) =>
              record.kind === RecordKind.Camp ? { ...record, isDraft: false } : record,
            ),
          }}
          weekNumber={2}
          onApprove={onApprove}
        />
      </ul>,
    );
    expect(screen.queryByRole('button', { name: /^Approve camp/ })).toBeNull();
    expect(screen.getByRole('listitem')).toHaveFocus();
  });

  it('announces the change to verified', () => {
    renderCard(
      cardFixture('v1', 'Fixture Day Camp', '2026-06-08', '2026-06-12', {
        verification: { kind: VerificationKind.Verified, on: '2026-10-13' },
      }),
      vi.fn(),
    );
    expect(
      screen.getByText('Verified Oct 13, 2026').closest('[aria-live="polite"]'),
    ).not.toBeNull();
  });
});
