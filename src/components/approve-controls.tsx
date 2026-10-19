'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { StatusPill } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import {
  type ApproveResult,
  needsSpanConfirmation,
  recordKey,
  spanDays,
} from '@/lib/catalog/approve';
import type { ChainRecord, SessionCardView } from '@/lib/catalog/session-cards';
import { RecordKind } from '@/lib/catalog/types';
import { shortMonthDay } from '@/lib/dates';
import {
  formatAddress,
  formatAges,
  formatGrades,
  formatHours,
  formatPrice,
} from '@/lib/session-card-format';

/**
 * A reviewer's approve controls on a card (CAM-46): one for each of the
 * session's provider, location, camp and session that is still a draft, top
 * down. Each approves only its own record. What may be approved, and why not,
 * is the database's call (ADR-0017 §2): a refusal is shown as the function
 * worded it, beside the control that was refused.
 */

export type OnApprove = (
  kind: RecordKind,
  id: string,
  confirmLongSpan: boolean,
) => Promise<ApproveResult>;

/** Asks a reviewer to say they checked a session that runs longer than a camp usually does. */
function LongSpanDialog({
  dialogRef,
  days,
  onConfirm,
  onCancel,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  days: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(90vw,24rem)] rounded-card border border-rule bg-surface p-4 text-ink backdrop:bg-ink/40"
    >
      <h4 id={titleId} className="text-title">
        This session runs {days} days
      </h4>
      <p className="mt-2 text-caption text-ink-muted">
        Most camps run one week, occasionally two. Approve only if you checked that the dates are
        right.
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm}>
          Approve
        </Button>
      </div>
    </dialog>
  );
}

function failureText(error: unknown): string {
  return error instanceof Error ? error.message : 'The approval did not go through.';
}

/** Chromium drops focus to the body when the focused button is disabled. */
function focusWasDropped(): boolean {
  return document.activeElement === document.body;
}

/**
 * One approval attempt at a time for a record. However it ends the control is
 * usable again: a refusal and a call that threw are both kept as `message`.
 */
function useAttempt(record: ChainRecord, onApprove: OnApprove, onApproved: () => void) {
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string>();
  const inFlight = useRef(false);

  async function run(confirmLongSpan: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setMessage(undefined);
    setWorking(true);
    try {
      const result = await onApprove(record.kind, record.id, confirmLongSpan);
      if (result.ok) onApproved();
      else setMessage(result.message);
    } catch (error) {
      setMessage(failureText(error));
    } finally {
      inFlight.current = false;
      setWorking(false);
    }
  }

  return { working, message, run };
}

/** Puts focus back on the control once a failed attempt has re-enabled it, if the disabling dropped it. */
function useRefocusAfterFailure(
  button: React.RefObject<HTMLButtonElement | null>,
  failed: boolean,
) {
  useEffect(() => {
    if (failed && focusWasDropped()) button.current?.focus();
  }, [button, failed]);
}

/** What a row shows for its record: a title and the facts a reviewer checks against the source. */
function describe(record: ChainRecord, card: SessionCardView): { title: string; lines: string[] } {
  if (record.kind !== RecordKind.Session) {
    return {
      title: record.name,
      lines: record.address === undefined ? [] : [formatAddress(record.address)],
    };
  }
  const days = `${shortMonthDay(card.startDate)} – ${shortMonthDay(card.endDate)}, ${card.startDate.slice(0, 4)}`;
  const people = [formatAges(card.ageRange), formatGrades(card.gradeRange)].filter(
    (range) => range !== undefined,
  );
  return {
    title: days,
    lines: [
      formatHours(card.startTime, card.endTime) ?? 'Hours not stated',
      people.length === 0 ? 'Ages and grades not stated' : people.join(' · '),
      formatPrice(card.priceCents) ?? 'Price not stated',
    ],
  };
}

function RecordLabel({ record, card }: { record: ChainRecord; card: SessionCardView }) {
  const { title, lines } = describe(record, card);
  return (
    <div className="min-w-0 flex-1 basis-40">
      <p className="text-caption capitalize text-ink-muted">{record.kind}</p>
      <p className="text-ui font-semibold text-ink">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-caption text-ink-muted">
          {line}
        </p>
      ))}
    </div>
  );
}

/**
 * One draft record's row: what it is, its status, and the one button that
 * approves it. A session that runs longer than the database accepts without a
 * say-so (`longSpanDays`) asks first.
 */
function ApproveRow({
  record,
  card,
  longSpanDays,
  onApprove,
  onApproved,
}: {
  record: ChainRecord;
  card: SessionCardView;
  longSpanDays: number | undefined;
  onApprove: OnApprove;
  onApproved: () => void;
}) {
  const { working, message, run } = useAttempt(record, onApprove, onApproved);
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useRefocusAfterFailure(button, !working && message !== undefined);

  function choose() {
    if (longSpanDays === undefined) void run(false);
    else dialog.current?.showModal();
  }

  function closeDialog() {
    dialog.current?.close();
    button.current?.focus();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <RecordLabel record={record} card={card} />
      <StatusPill isDraft />
      <Button
        ref={button}
        type="button"
        variant="outline"
        aria-label={`Approve ${record.kind}: ${record.name}`}
        disabled={working}
        onClick={choose}
      >
        {working ? 'Approving…' : 'Approve'}
      </Button>
      {message === undefined ? null : (
        <p role="alert" className="basis-full text-caption text-brick">
          {message}
        </p>
      )}
      {longSpanDays === undefined ? null : (
        <LongSpanDialog
          dialogRef={dialog}
          days={longSpanDays}
          onConfirm={() => {
            closeDialog();
            void run(true);
          }}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}

function VerifiedRow({ record, card }: { record: ChainRecord; card: SessionCardView }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <RecordLabel record={record} card={card} />
      <StatusPill isDraft={false} />
    </div>
  );
}

export function ApproveControls({
  card,
  onApprove,
  onApproved,
}: {
  card: SessionCardView;
  onApprove: OnApprove;
  /** Called once a record is verified, while its control is still on screen. */
  onApproved: () => void;
}) {
  if (!card.records.some((record) => record.isDraft)) return null;
  const asksFirst = needsSpanConfirmation(card.startDate, card.endDate);
  return (
    <fieldset className="m-0 min-w-0 divide-y divide-rule border-rule border-t p-0">
      <legend className="sr-only">Records to review</legend>
      {card.records.map((record) =>
        record.isDraft ? (
          <ApproveRow
            key={recordKey(record.kind, record.id)}
            record={record}
            card={card}
            longSpanDays={
              asksFirst && record.kind === RecordKind.Session
                ? spanDays(card.startDate, card.endDate)
                : undefined
            }
            onApprove={onApprove}
            onApproved={onApproved}
          />
        ) : (
          <VerifiedRow key={recordKey(record.kind, record.id)} record={record} card={card} />
        ),
      )}
    </fieldset>
  );
}
