import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/db/types';
import { approveRecord, needsSpanConfirmation, spanDays } from './approve';
import { RecordKind } from './types';

/**
 * Approving a record from its card (CAM-46). The database decides everything
 * (ADR-0017 §2): this only calls `approve_record()` as the signed-in user and
 * hands its answer back. The real refusals are in
 * supabase/tests/session-cards.rls.test.ts.
 */

interface FakeOptions {
  readonly refusal?: string;
  readonly verifiedAt?: string | null;
}

function fakeClient({ refusal, verifiedAt = '2026-10-14T02:00:00Z' }: FakeOptions = {}) {
  const rpc = vi.fn(async () => ({ error: refusal === undefined ? null : { message: refusal } }));
  const single = vi.fn(async () => ({ data: { verified_at: verifiedAt }, error: null }));
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { rpc, from } as unknown as SupabaseClient<Database>,
    rpc,
    from,
    select,
    eq,
  };
}

describe('approveRecord', () => {
  it('calls approve_record with the kind and id, and no span confirmation', async () => {
    const { client, rpc } = fakeClient();
    await approveRecord(client, RecordKind.Camp, 'camp-1');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('approve_record', {
      record_kind: 'camp',
      record_id: 'camp-1',
      confirm_long_span: false,
    });
  });

  it('passes confirm_long_span only when told to', async () => {
    const { client, rpc } = fakeClient();
    await approveRecord(client, RecordKind.Session, 'session-1', true);
    expect(rpc).toHaveBeenCalledWith('approve_record', {
      record_kind: 'session',
      record_id: 'session-1',
      confirm_long_span: true,
    });
  });

  it('returns the day it was verified, in Richmond', async () => {
    // 02:00 UTC on Oct 14 is 10pm on Oct 13 in Richmond.
    const { client } = fakeClient({ verifiedAt: '2026-10-14T02:00:00Z' });
    expect(await approveRecord(client, RecordKind.Camp, 'camp-1')).toEqual({
      ok: true,
      on: '2026-10-13',
    });
  });

  it.each([
    [RecordKind.Provider, 'providers'],
    [RecordKind.Camp, 'camps'],
    [RecordKind.Location, 'locations'],
    [RecordKind.Session, 'sessions'],
  ])('reads %s back from %s', async (kind, table) => {
    const { client, from, eq } = fakeClient();
    await approveRecord(client, kind, 'the-id');
    expect(from).toHaveBeenCalledWith(table);
    expect(eq).toHaveBeenCalledWith('id', 'the-id');
  });

  it("returns the function's message as-is when it refuses, and reads nothing back", async () => {
    const message = "approve the session's camp, provider and location first";
    const { client, from } = fakeClient({ refusal: message });
    expect(await approveRecord(client, RecordKind.Session, 'session-1')).toEqual({
      ok: false,
      message,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('throws when an approved record comes back with no verified date', async () => {
    const { client } = fakeClient({ verifiedAt: null });
    await expect(approveRecord(client, RecordKind.Camp, 'camp-1')).rejects.toThrow(
      /no verified date/,
    );
  });
});

describe('spanDays', () => {
  it('counts both ends', () => {
    expect(spanDays('2026-06-01', '2026-06-01')).toBe(1);
    expect(spanDays('2026-06-01', '2026-06-05')).toBe(5);
  });

  it('crosses a month end', () => {
    expect(spanDays('2026-06-29', '2026-07-03')).toBe(5);
  });
});

describe('needsSpanConfirmation', () => {
  it('is false at 14 days and true at 15, as approve_record() decides it', () => {
    expect(needsSpanConfirmation('2026-06-01', '2026-06-14')).toBe(false);
    expect(needsSpanConfirmation('2026-06-01', '2026-06-15')).toBe(true);
  });
});
