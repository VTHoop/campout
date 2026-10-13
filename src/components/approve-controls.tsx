'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { type ApproveResult, needsSpanConfirmation, spanDays } from '@/lib/catalog/approve';
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

const KIND_LABELS = new Map(
  Object.entries({
    [RecordKind.Provider]: 'provider',
    [RecordKind.Location]: 'location',
    [RecordKind.Camp]: 'camp',
    [RecordKind.Session]: 'session',
  } satisfies Record<RecordKind, string>),
);

function keyOf(record: ChainRecord): string {
  return `${record.kind}:${record.id}`;
}

function labelOf(record: ChainRecord): string {
  return `${KIND_LABELS.get(record.kind)}: ${record.name}`;
}

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
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="long-span-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(90vw,24rem)] rounded-card border border-rule bg-surface p-4 text-ink backdrop:bg-ink/40"
    >
      <h4 id="long-span-title" className="text-title">
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
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [refusals, setRefusals] = useState<ReadonlyMap<string, string>>(new Map());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const drafts = card.records.filter((record) => record.isDraft);
  const days = spanDays(card.startDate, card.endDate);

  async function approve(record: ChainRecord, confirmLongSpan: boolean) {
    const key = keyOf(record);
    setRefusals((all) => new Map([...all].filter(([other]) => other !== key)));
    setPending((all) => new Set(all).add(key));
    const result = await onApprove(record.kind, record.id, confirmLongSpan);
    setPending((all) => new Set([...all].filter((other) => other !== key)));
    if (result.ok) onApproved();
    else setRefusals((all) => new Map(all).set(key, result.message));
  }

  function choose(record: ChainRecord, button: HTMLElement) {
    if (pending.has(keyOf(record))) return;
    const long =
      record.kind === RecordKind.Session && needsSpanConfirmation(card.startDate, card.endDate);
    if (!long) {
      void approve(record, false);
      return;
    }
    opener.current = button;
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    opener.current?.focus();
  }

  if (drafts.length === 0) return null;
  const session = card.records.find((record) => record.kind === RecordKind.Session);
  return (
    <div className="flex flex-col gap-2 border-rule border-t pt-3">
      {drafts.map((record) => {
        const working = pending.has(keyOf(record));
        const refusal = refusals.get(keyOf(record));
        return (
          <div key={keyOf(record)} className="flex flex-col gap-1">
            <Button
              type="button"
              variant="outline"
              aria-label={`Approve ${labelOf(record)}`}
              disabled={working}
              onClick={(event) => choose(record, event.currentTarget)}
              className="justify-start whitespace-normal text-left"
            >
              {working ? 'Approving…' : `Approve ${KIND_LABELS.get(record.kind)}`}
            </Button>
            {refusal === undefined ? null : (
              <p role="alert" className="text-caption text-brick">
                {refusal}
              </p>
            )}
          </div>
        );
      })}
      {session === undefined ? null : (
        <LongSpanDialog
          dialogRef={dialogRef}
          days={days}
          onConfirm={() => {
            closeDialog();
            void approve(session, true);
          }}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
