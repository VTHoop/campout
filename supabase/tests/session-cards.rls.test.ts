import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listSessionCards, VerificationKind } from '../../src/lib/catalog/session-cards';
import type { Database } from '../../src/lib/db/types';
import { createReviewer } from './catalog-fixtures';
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
    const cards = await listSessionCards(signedOut());
    expect(cards.map((card) => card.id)).toEqual(VERIFIED_SESSIONS);
    expect(cards.every((card) => card.verification.kind === VerificationKind.Verified)).toBe(true);
  });

  it('shows a signed-in parent the same, and no draft', async () => {
    const cards = await listSessionCards(typed(parent));
    expect(cards.map((card) => card.id)).toEqual(VERIFIED_SESSIONS);
  });

  it('shows a reviewer the draft too, marked as one, with its source', async () => {
    const cards = await listSessionCards(typed(reviewer));
    expect(cards.map((card) => card.id)).toEqual([...VERIFIED_SESSIONS, DRAFT_SESSION]);
    expect(cards.find((card) => card.id === DRAFT_SESSION)?.verification).toEqual({
      kind: VerificationKind.Draft,
      sourceUrl: 'https://riverbend.example.test/clay',
    });
  });

  it('carries a verified session joined to its camp, provider, location and option', async () => {
    const cards = await listSessionCards(signedOut());
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
});
