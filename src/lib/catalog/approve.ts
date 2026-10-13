import type { CalendarDate } from '@campout/planner';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';
import type { RecordKind } from './types';

/** What the database said to an approval: the day it was verified, or why it refused. */
export type ApproveResult =
  | { readonly ok: true; readonly on: CalendarDate }
  | { readonly ok: false; readonly message: string };

export function spanDays(_start: CalendarDate, _end: CalendarDate): number {
  return 0;
}

export function needsSpanConfirmation(_start: CalendarDate, _end: CalendarDate): boolean {
  return false;
}

export async function approveRecord(
  _client: SupabaseClient<Database>,
  _kind: RecordKind,
  _id: string,
  _confirmLongSpan = false,
): Promise<ApproveResult> {
  throw new Error('not implemented');
}
