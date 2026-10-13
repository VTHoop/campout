'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  type ApproveResult,
  needsSpanConfirmation,
  recordKey,
  spanDays,
} from '@/lib/catalog/approve';
import type { ChainRecord, SessionCardView } from '@/lib/catalog/session-cards';
import { RecordKind } from '@/lib/catalog/types';

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

/**
 * One draft record's control. A session that runs longer than the database
 * accepts without a say-so (`longSpanDays`) asks first.
 */
function ApproveRow({
  record,
  longSpanDays,
  onApprove,
  onApproved,
}: {
  record: ChainRecord;
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
    <div className="flex flex-col gap-1">
      <Button
        ref={button}
        type="button"
        variant="outline"
        aria-label={`Approve ${record.kind}: ${record.name}`}
        disabled={working}
        onClick={choose}
        className="justify-start whitespace-normal text-left"
      >
        {working ? 'Approving…' : `Approve ${record.kind}`}
      </Button>
      {message === undefined ? null : (
        <p role="alert" className="text-caption text-brick">
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
  const drafts = card.records.filter((record) => record.isDraft);
  if (drafts.length === 0) return null;
  const asksFirst = needsSpanConfirmation(card.startDate, card.endDate);
  return (
    <div className="flex flex-col gap-2 border-rule border-t pt-3">
      {drafts.map((record) => (
        <ApproveRow
          key={recordKey(record.kind, record.id)}
          record={record}
          longSpanDays={
            asksFirst && record.kind === RecordKind.Session
              ? spanDays(card.startDate, card.endDate)
              : undefined
          }
          onApprove={onApprove}
          onApproved={onApproved}
        />
      ))}
    </div>
  );
}
