import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { approveRecord, isReviewer } from '../../src/lib/catalog/approve';
import { listSessionCards, VerificationKind } from '../../src/lib/catalog/session-cards';
import { RecordKind } from '../../src/lib/catalog/types';
import type { Database } from '../../src/lib/db/types';
import {
  approve,
  createReviewer,
  insertId,
  optionRow,
  type SeededSession,
  withSeededSession,
} from './catalog-fixtures';
import { createTestUser, deleteTestUsers, localKeys, type TestUser } from './helpers';

/**
 * The directory's read (CAM-28) against the local seed, as each kind of visitor:
 * the app adds no status filter, so what each one sees is the database's
 * decision alone (ADR-0017 §2). The seed holds four verified sessions and one
 * draft, from a draft camp at a draft location.
 */

const DRAFT_SESSION = '00000000-0000-4000-8000-000000000305';
const VERIFIED_SESSIONS = [
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000303',
  '00000000-0000-4000-8000-000000000304',
];

/** The harness's clients are untyped; the same client, told which database it reads. */
function typed(user: TestUser): SupabaseClient<Database> {
  return user.client as unknown as SupabaseClient<Database>;
}

function signedOut() {
  const { url, publishableKey } = localKeys();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const SUMMER_2027 = { start: '2027-06-07', end: '2027-08-20' } as const;

let parent: TestUser;
let reviewer: TestUser;

beforeAll(async () => {
  parent = await createTestUser('parent');
  reviewer = await createReviewer('reviewer');
});

afterAll(async () => {
  await deleteTestUsers([parent, reviewer]);
});

describe('listSessionCards', () => {
  it('shows a signed-out visitor only the verified sessions', async () => {
    const cards = await listSessionCards(signedOut(), SUMMER_2027);
    expect(cards.map((card) => card.id)).toEqual(VERIFIED_SESSIONS);
    expect(cards.every((card) => card.verification.kind === VerificationKind.Verified)).toBe(true);
  });

  it('shows a signed-in parent the same, and no draft', async () => {
    const cards = await listSessionCards(typed(parent), SUMMER_2027);
    expect(cards.map((card) => card.id)).toEqual(VERIFIED_SESSIONS);
  });

  it('shows a reviewer the draft too, marked as one, with its source', async () => {
    const cards = await listSessionCards(typed(reviewer), SUMMER_2027);
    expect(cards.map((card) => card.id)).toEqual([...VERIFIED_SESSIONS, DRAFT_SESSION]);
    expect(cards.find((card) => card.id === DRAFT_SESSION)?.verification).toEqual({
      kind: VerificationKind.Draft,
      sourceUrl: 'https://riverbend.example.test/clay',
    });
  });

  it('carries a verified session joined to its camp, provider, location and option', async () => {
    const cards = await listSessionCards(signedOut(), SUMMER_2027);
    expect(cards[0]).toMatchObject({
      campName: 'Maple Hollow Summer Camp',
      providerName: 'Maple Hollow Rec League',
      locationName: 'Cedar Run Community Center',
      city: 'Midlothian',
      startDate: '2027-06-21',
      startTime: '09:00',
      endTime: '16:00',
      priceCents: 32_500,
      verification: { kind: VerificationKind.Verified, on: '2026-09-01' },
    });
  });
  it('reads only the sessions that overlap the window', async () => {
    const week = { start: '2027-06-21', end: '2027-06-25' } as const;
    expect((await listSessionCards(signedOut(), week)).map((card) => card.id)).toEqual([
      VERIFIED_SESSIONS[0],
    ]);
  });

  it('includes a session that starts before the window and runs into it', async () => {
    const lateInTheWeek = { start: '2027-06-24', end: '2027-06-24' } as const;
    expect((await listSessionCards(signedOut(), lateInTheWeek)).map((card) => card.id)).toEqual([
      VERIFIED_SESSIONS[0],
    ]);
  });

  it('reads nothing for a summer with no sessions', async () => {
    const summer2026 = { start: '2026-06-01', end: '2026-08-21' } as const;
    expect(await listSessionCards(signedOut(), summer2026)).toEqual([]);
  });
});

/**
 * Approving from the card (CAM-46), through the service the card uses and the
 * reviewer's own session: the function decides, and its words come back as
 * written. Each test stands up its own draft chain, so the seed is untouched.
 */
describe('approving from the card', () => {
  const FIXTURE_WINDOW = { start: '2027-07-12', end: '2027-07-16' } as const;

  async function cardOf(user: TestUser, ids: SeededSession) {
    const cards = await listSessionCards(typed(user), FIXTURE_WINDOW);
    const card = cards.find((candidate) => candidate.id === ids.sessionId);
    if (card === undefined) throw new Error('the fixture session did not come back');
    return card;
  }

  async function approveAs(user: TestUser, kind: RecordKind, id: string, confirm = false) {
    return approveRecord(typed(user), kind, id, confirm);
  }

  /** Setup, not the thing under test: the throwing `approve()` fails loudly if a step does not land. */
  async function approveParents(ids: SeededSession) {
    await approve(reviewer, 'provider', ids.providerId);
    await approve(reviewer, 'location', ids.locationId);
    await approve(reviewer, 'camp', ids.campId);
  }

  it('says who is a reviewer: a reviewer, and not a parent or a signed-out visitor', async () => {
    expect(await isReviewer(typed(reviewer))).toBe(true);
    expect(await isReviewer(typed(parent))).toBe(false);
    expect(await isReviewer(signedOut())).toBe(false);
  });

  it('approves the chain top down, each record on its own, and the card updates to verified', () =>
    withSeededSession(async (ids, admin) => {
      await insertId(admin, 'session_options', optionRow(ids.sessionId));

      const first = await cardOf(reviewer, ids);
      expect(first.records.map((record) => record.isDraft)).toEqual([true, true, true, true]);

      for (const [kind, id] of [
        [RecordKind.Provider, ids.providerId],
        [RecordKind.Location, ids.locationId],
        [RecordKind.Camp, ids.campId],
      ] as const) {
        expect(await approveAs(reviewer, kind, id)).toMatchObject({ ok: true });
      }
      const midway = await cardOf(reviewer, ids);
      expect(midway.records.map((record) => record.isDraft)).toEqual([false, false, false, true]);
      expect(midway.verification.kind).toBe(VerificationKind.Draft);

      const result = await approveAs(reviewer, RecordKind.Session, ids.sessionId);
      expect(result).toMatchObject({ ok: true, on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
      const done = await cardOf(reviewer, ids);
      expect(done.records.every((record) => !record.isDraft)).toBe(true);
      expect(done.verification.kind).toBe(VerificationKind.Verified);
    }));

  it('refuses a session before its chain, in the function’s words, and it stays a draft', () =>
    withSeededSession(async (ids, admin) => {
      await insertId(admin, 'session_options', optionRow(ids.sessionId));
      expect(await approveAs(reviewer, RecordKind.Session, ids.sessionId)).toEqual({
        ok: false,
        message: "approve the session's camp, provider and location first",
      });
      expect((await cardOf(reviewer, ids)).verification.kind).toBe(VerificationKind.Draft);
    }));

  it('refuses a camp before its provider', () =>
    withSeededSession(async (ids) => {
      expect(await approveAs(reviewer, RecordKind.Camp, ids.campId)).toEqual({
        ok: false,
        message: "approve the camp's provider first",
      });
    }));

  it('refuses a session with no time option', () =>
    withSeededSession(async (ids) => {
      await approveParents(ids);
      expect(await approveAs(reviewer, RecordKind.Session, ids.sessionId)).toEqual({
        ok: false,
        message: 'a session needs at least one time option',
      });
    }));

  it('refuses a session longer than 14 days until the reviewer confirms, and says how long', () =>
    withSeededSession(async (ids, admin) => {
      const { error } = await admin
        .from('sessions')
        .update({ end_date: '2027-07-26' })
        .eq('id', ids.sessionId);
      if (error) throw new Error(`Could not stretch the session: ${error.message}`);
      await insertId(admin, 'session_options', optionRow(ids.sessionId));
      await approveParents(ids);

      expect(await approveAs(reviewer, RecordKind.Session, ids.sessionId)).toEqual({
        ok: false,
        message: 'the session spans 15 days; confirm it before approving',
      });
      expect(await approveAs(reviewer, RecordKind.Session, ids.sessionId, true)).toMatchObject({
        ok: true,
      });
    }));

  it('refuses a parent, and the record stays a draft', () =>
    withSeededSession(async (ids) => {
      expect(await approveAs(parent, RecordKind.Provider, ids.providerId)).toEqual({
        ok: false,
        message: 'only a reviewer can approve',
      });
      expect((await cardOf(reviewer, ids)).records[0]?.isDraft).toBe(true);
    }));
});
