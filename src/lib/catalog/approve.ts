import { type CalendarDate, daysBetween } from '@campout/planner';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';
import { richmondDate } from '../today';
import { type SessionCardView, VerificationKind } from './session-cards';
import { RecordKind } from './types';

/**
 * Approving a record from its card (CAM-46). `approve_record()` is the only
 * way to verified, and it decides everything (ADR-0017 §2): this calls it as
 * the signed-in user and hands back what it said. It adds no rule of its own.
 */

/** What the database said to an approval: the day it was verified, or why it refused. */
export type ApproveResult =
  | { readonly ok: true; readonly on: CalendarDate }
  | { readonly ok: false; readonly message: string };

/** A session longer than this needs the reviewer to say they checked (`assert_approvable`). */
const LONG_SPAN_DAYS = 14;

/** Days a session runs, counting both ends. */
export function spanDays(start: CalendarDate, end: CalendarDate): number {
  return daysBetween(start, end) + 1;
}

export function needsSpanConfirmation(start: CalendarDate, end: CalendarDate): boolean {
  return spanDays(start, end) > LONG_SPAN_DAYS;
}

type VerifiedTable = 'providers' | 'camps' | 'locations' | 'sessions';

/** An exhaustive table, read through a Map. */
const TABLES: ReadonlyMap<string, VerifiedTable> = new Map(
  Object.entries({
    [RecordKind.Provider]: 'providers',
    [RecordKind.Camp]: 'camps',
    [RecordKind.Location]: 'locations',
    [RecordKind.Session]: 'sessions',
  } satisfies Record<RecordKind, VerifiedTable>),
);

/** The day `id` was verified, in Richmond, read back from the row the function just wrote. */
async function verifiedOn(
  client: SupabaseClient<Database>,
  kind: RecordKind,
  id: string,
): Promise<CalendarDate> {
  const table = TABLES.get(kind);
  if (table === undefined) throw new Error(`No table for record kind ${kind}`);
  const { data, error } = await client.from(table).select('verified_at').eq('id', id).single();
  if (error)
    throw new Error(`Could not read ${kind} ${id} back: ${error.message}`, { cause: error });
  if (data.verified_at === null)
    throw new Error(`${kind} ${id} was approved but has no verified date`);
  return richmondDate(new Date(data.verified_at));
}

export async function approveRecord(
  client: SupabaseClient<Database>,
  kind: RecordKind,
  id: string,
  confirmLongSpan = false,
): Promise<ApproveResult> {
  const { error } = await client.rpc('approve_record', {
    record_kind: kind,
    record_id: id,
    confirm_long_span: confirmLongSpan,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, on: await verifiedOn(client, kind, id) };
}

/** Which approvals have happened in this view, by record, with the day each was verified. */
export type Approvals = ReadonlyMap<string, CalendarDate>;

export function recordKey(kind: RecordKind, id: string): string {
  return `${kind}:${id}`;
}

/** The cards as they stand once `approvals` have happened: each approved record verified wherever a card carries it. */
export function applyApprovals(
  cards: readonly SessionCardView[],
  approvals: Approvals,
): readonly SessionCardView[] {
  if (approvals.size === 0) return cards;
  return cards.map((card) => {
    const sessionDay = approvals.get(recordKey(RecordKind.Session, card.id));
    return {
      ...card,
      records: card.records.map((record) => ({
        ...record,
        isDraft: record.isDraft && !approvals.has(recordKey(record.kind, record.id)),
      })),
      ...(sessionDay === undefined
        ? {}
        : { verification: { kind: VerificationKind.Verified, on: sessionDay } }),
    };
  });
}

/** Whether the visitor is a reviewer, as the database says: `is_reviewer()` is false for anon. */
export async function isReviewer(client: SupabaseClient<Database>): Promise<boolean> {
  const { data, error } = await client.rpc('is_reviewer');
  if (error)
    throw new Error(`Could not ask whether you are a reviewer: ${error.message}`, { cause: error });
  return data;
}
