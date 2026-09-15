import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  anonClient,
  createHousehold,
  createTestUser,
  deleteTestUsers,
  serviceClient,
  type TestUser,
} from './helpers';

/**
 * Row Level Security policy tests (ADR-0004).
 *
 * Two real households, two real JWTs, one real Postgres. The assertion that
 * matters throughout is the **negative** one, and specifically that a stranger
 * gets **zero rows rather than an error**. Zero rows is what a correct policy
 * produces; an error usually means the query failed for some unrelated reason
 * and the test is proving nothing.
 *
 * Several tests therefore check twice: the stranger sees nothing, AND the
 * service-role client confirms the row is really there. Without the second half,
 * a test that deleted the row by accident would still pass.
 */

let alice: TestUser;
let bob: TestUser;
let aliceHousehold: string;
let bobHousehold: string;
let aliceChild: string;

beforeAll(async () => {
  alice = await createTestUser('alice');
  bob = await createTestUser('bob');

  aliceHousehold = await createHousehold(alice, 'Alice Household');
  bobHousehold = await createHousehold(bob, 'Bob Household');

  const { data, error } = await alice.client
    .from('children')
    .insert({ household_id: aliceHousehold, display_name: 'Pip', age_years: 7, grade: 2 })
    .select('id')
    .single();
  if (error) throw new Error(`fixture: could not add Alice's child: ${error.message}`);
  aliceChild = data.id as string;
}, 60_000);

afterAll(async () => {
  await deleteTestUsers([alice, bob]);
});

describe('create_household', () => {
  // The only path to a household. A direct insert has no policy to satisfy, so
  // there is no way to produce a household without its first member.
  it('refuses a direct insert into households', async () => {
    const { error } = await alice.client
      .from('households')
      .insert({ name: 'Back Door', district: 'henrico' });

    expect(error).not.toBeNull();

    const all = await serviceClient().from('households').select('name').eq('name', 'Back Door');
    expect(all.data).toEqual([]);
  });

  it('refuses an unauthenticated caller', async () => {
    const { error } = await anonClient().rpc('create_household', {
      household_name: 'Nobody',
      household_district: 'hanover',
    });

    expect(error).not.toBeNull();
  });

  it('makes the creator a member in the same transaction', async () => {
    const { data, error } = await alice.client
      .from('household_members')
      .select('user_id')
      .eq('household_id', aliceHousehold);

    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: alice.id }]);
  });

  it('lets the creator read back the household they just made', async () => {
    const { data, error } = await alice.client
      .from('households')
      .select('id, name')
      .eq('id', aliceHousehold);

    expect(error).toBeNull();
    expect(data).toEqual([{ id: aliceHousehold, name: 'Alice Household' }]);
  });
});

describe('children are invisible across households', () => {
  it('shows a member their own children', async () => {
    const { data, error } = await alice.client
      .from('children')
      .select('id, display_name')
      .eq('household_id', aliceHousehold);

    expect(error).toBeNull();
    expect(data).toEqual([{ id: aliceChild, display_name: 'Pip' }]);
  });

  // The core assertion of the whole suite.
  it('returns zero rows — not an error — when a stranger reads another household', async () => {
    const { data, error } = await bob.client
      .from('children')
      .select('id, display_name')
      .eq('household_id', aliceHousehold);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('hides the row even when the stranger knows its exact id', async () => {
    const { data, error } = await bob.client.from('children').select('id').eq('id', aliceChild);

    expect(error).toBeNull();
    expect(data).toEqual([]);

    // …and the row really is there. Otherwise the test above passes vacuously.
    const asAdmin = await serviceClient().from('children').select('id').eq('id', aliceChild);
    expect(asAdmin.data).toEqual([{ id: aliceChild }]);
  });

  it('returns nothing to a stranger listing children unfiltered', async () => {
    const { data, error } = await bob.client.from('children').select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe('a stranger cannot write into another household', () => {
  it('refuses an insert into a household they do not belong to', async () => {
    const { error } = await bob.client
      .from('children')
      .insert({ household_id: aliceHousehold, display_name: 'Intruder', age_years: 9, grade: 4 });

    expect(error).not.toBeNull();

    const remaining = await serviceClient()
      .from('children')
      .select('id')
      .eq('household_id', aliceHousehold);
    expect(remaining.data).toEqual([{ id: aliceChild }]);
  });

  // An UPDATE filtered by a policy matches no rows, so it succeeds while changing
  // nothing. Asserting on the error alone would miss a policy that actually allowed
  // the write — the value has to be checked afterwards.
  it('silently affects no rows on an update, leaving the value untouched', async () => {
    const { error } = await bob.client
      .from('children')
      .update({ display_name: 'Renamed' })
      .eq('id', aliceChild);

    expect(error).toBeNull();

    const after = await serviceClient()
      .from('children')
      .select('display_name')
      .eq('id', aliceChild)
      .single();
    expect(after.data?.display_name).toBe('Pip');
  });

  it('silently affects no rows on a delete, leaving the child in place', async () => {
    const { error } = await bob.client.from('children').delete().eq('id', aliceChild);

    expect(error).toBeNull();

    const after = await serviceClient().from('children').select('id').eq('id', aliceChild);
    expect(after.data).toEqual([{ id: aliceChild }]);
  });
});

describe('household membership cannot be self-granted', () => {
  it('refuses a stranger adding themselves to a household', async () => {
    const { error } = await bob.client
      .from('household_members')
      .insert({ household_id: aliceHousehold, user_id: bob.id });

    expect(error).not.toBeNull();

    const members = await serviceClient()
      .from('household_members')
      .select('user_id')
      .eq('household_id', aliceHousehold);
    expect(members.data).toEqual([{ user_id: alice.id }]);
  });

  it('hides another household from a stranger', async () => {
    const { data, error } = await bob.client
      .from('households')
      .select('id')
      .eq('id', aliceHousehold);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('leaves another household untouched by a stranger renaming it', async () => {
    const { error } = await bob.client
      .from('households')
      .update({ name: 'Bob Was Here' })
      .eq('id', aliceHousehold);

    expect(error).toBeNull();

    const after = await serviceClient()
      .from('households')
      .select('name')
      .eq('id', aliceHousehold)
      .single();
    expect(after.data?.name).toBe('Alice Household');
  });

  it('does not leak another household through the membership table', async () => {
    const { data, error } = await bob.client
      .from('household_members')
      .select('household_id, user_id');

    expect(error).toBeNull();
    expect(data).toEqual([{ household_id: bobHousehold, user_id: bob.id }]);
  });
});

describe('the anonymous visitor', () => {
  it('sees no children at all', async () => {
    const { data, error } = await anonClient().from('children').select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('sees no households at all', async () => {
    const { data, error } = await anonClient().from('households').select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
