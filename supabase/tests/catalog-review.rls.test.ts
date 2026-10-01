import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SeededSession } from './catalog-fixtures';
import {
  approve,
  approveChain,
  createReviewer,
  insertId,
  LOCATION,
  optionRow,
  PROVENANCE,
  sessionRow,
  withCampAndLocation,
  withSeededSession,
} from './catalog-fixtures';
import type { TestUser } from './helpers';
import {
  anonClient,
  createHousehold,
  createTestUser,
  deleteTestUsers,
  isLiveProject,
  runSql,
  serviceClient,
} from './helpers';

/**
 * The catalog's review gate (CAM-27 PR 2, ADR-0017). Release-blocking in the
 * same way as the household suite: this is what keeps unreviewed data away
 * from parents.
 *
 * - Drafts are invisible to everyone but reviewers; a session is public only
 *   when it, its camp, its provider and its location are all verified (16).
 * - Only approve_record() makes a row verified, and only reviewer_edit()
 *   changes a verified row's facts (13). A trigger enforces both, even for
 *   the secret key — against mistakes, not a key holder who disables it.
 * - Every write is recorded in catalog_history.
 * - Plans survive catalog changes, and a plan entry must name the
 *   household's own child and a verified session (15).
 *
 * Error codes: 42501 insufficient_privilege (RLS, a grant, the guard, a
 * non-reviewer) · 55000 object_not_in_prerequisite_state (approval refused) ·
 * 22023 invalid_parameter_value (an edit outside a row's facts) ·
 * 23503 foreign_key_violation.
 */

let reviewer: TestUser;
let parent: TestUser;
let otherParent: TestUser;

beforeAll(async () => {
  reviewer = await createReviewer('catalog-review-reviewer');
  parent = await createTestUser('catalog-review-parent');
  otherParent = await createTestUser('catalog-review-other-parent');
});

afterAll(async () => {
  await deleteTestUsers([reviewer, parent, otherParent]);
});

const NON_REVIEWERS = [
  ['an anonymous visitor', () => anonClient()],
  ['a signed-in non-reviewer', () => parent.client],
] as const;

async function isVisible(client: SupabaseClient, table: string, id: string): Promise<boolean> {
  const { data, error } = await client.from(table).select('id').eq('id', id);
  expect(error).toBeNull();
  return (data ?? []).length === 1;
}

/** Whether search_sessions, over the fixture session's week, returns it to `client`. */
async function searchHits(client: SupabaseClient, sessionId: string): Promise<boolean> {
  const { data, error } = await client.rpc('search_sessions', {
    window_start: '2027-07-12',
    window_end: '2027-07-16',
  });
  expect(error).toBeNull();
  return (data as { session_id: string }[]).some((row) => row.session_id === sessionId);
}

/** The chain's rows by table, for a test that checks each one. */
function chainRows(ids: SeededSession, optionId: string): [string, string][] {
  return [
    ['providers', ids.providerId],
    ['camps', ids.campId],
    ['locations', ids.locationId],
    ['sessions', ids.sessionId],
    ['session_options', optionId],
  ];
}

const CALENDAR = {
  district: 'henrico',
  type: 'traditional',
  label: '2098-99',
  first_instructional_day: '2098-08-25',
  last_instructional_day: '2099-06-12',
  covers_from: '2098-07-01',
  covers_to: '2099-06-30',
  source_url: 'https://example.test/calendar',
};

/** A draft calendar with one closure, removed afterwards (closures cascade). */
async function withDraftCalendar(
  assert: (ids: { calendarId: string; closureId: string }, admin: SupabaseClient) => Promise<void>,
): Promise<void> {
  const admin = serviceClient();
  const calendarId = await insertId(admin, 'school_calendars', CALENDAR);
  try {
    const closureId = await insertId(admin, 'school_closures', {
      calendar_id: calendarId,
      start_date: '2098-09-07',
      end_date: '2098-09-07',
      source_label: 'Labor Day',
    });
    await assert({ calendarId, closureId }, admin);
  } finally {
    // A verified calendar can't be deleted; put it back to draft first.
    await admin.from('school_calendars').update({ status: 'draft' }).eq('id', calendarId);
    await admin.from('school_calendars').delete().eq('id', calendarId);
  }
}

type ApprovedSession = SeededSession & { optionId: string };

/** A session with one option, approved up its whole chain by the reviewer. */
async function withApprovedSession(
  assert: (ids: ApprovedSession, admin: SupabaseClient) => Promise<void>,
): Promise<void> {
  await withSeededSession(async (ids, admin) => {
    const optionId = await approveChain(reviewer, ids, admin);
    await assert({ ...ids, optionId }, admin);
  });
}

type CalendarIds = { calendarId: string; closureId: string };

/** A calendar with one closure, approved by the reviewer. */
async function withApprovedCalendar(
  assert: (ids: CalendarIds, admin: SupabaseClient) => Promise<void>,
): Promise<void> {
  await withDraftCalendar(async (ids, admin) => {
    await approve(reviewer, 'school_calendar', ids.calendarId);
    await assert(ids, admin);
  });
}

/** reviewer_edit as the reviewer, returning the error (or null). */
async function editAsReviewer(kind: string, id: string, changes: Record<string, unknown>) {
  const { error } = await reviewer.client.rpc('reviewer_edit', {
    record_kind: kind,
    record_id: id,
    changes,
  });
  return error;
}

async function readRow(admin: SupabaseClient, table: string, id: string) {
  const { data } = await admin.from(table).select('*').eq('id', id).single();
  return data as Record<string, unknown> | null;
}

// ---------------------------------------------------------------- visibility

describe.each(NON_REVIEWERS)('drafts are invisible to %s', (_who, clientFor) => {
  it('sees no draft provider, camp, location, session or option', async () => {
    await withSeededSession(async (ids, admin) => {
      const optionId = await insertId(admin, 'session_options', optionRow(ids.sessionId));
      for (const [table, id] of chainRows(ids, optionId)) {
        expect(await isVisible(clientFor(), table, id), table).toBe(false);
      }
    });
  });

  it('sees no draft calendar and none of its closures', async () => {
    await withDraftCalendar(async ({ calendarId, closureId }) => {
      expect(await isVisible(clientFor(), 'school_calendars', calendarId)).toBe(false);
      expect(await isVisible(clientFor(), 'school_closures', closureId)).toBe(false);
    });
  });

  it('finds no draft session through search', async () => {
    await withSeededSession(async ({ sessionId }) => {
      const { data, error } = await clientFor().rpc('search_sessions', {
        window_start: '2027-07-12',
        window_end: '2027-07-16',
      });
      expect(error).toBeNull();
      expect((data as { session_id: string }[]).map((row) => row.session_id)).not.toContain(
        sessionId,
      );
    });
  });
});

describe('reviewers', () => {
  it('read drafts across the whole chain', async () => {
    await withSeededSession(async (ids, admin) => {
      const optionId = await insertId(admin, 'session_options', optionRow(ids.sessionId));
      for (const [table, id] of chainRows(ids, optionId)) {
        expect(await isVisible(reviewer.client, table, id), table).toBe(true);
      }
    });
  });

  it('read draft calendars and their closures', async () => {
    await withDraftCalendar(async ({ calendarId, closureId }) => {
      expect(await isVisible(reviewer.client, 'school_calendars', calendarId)).toBe(true);
      expect(await isVisible(reviewer.client, 'school_closures', closureId)).toBe(true);
    });
  });
});

describe('the verified chain', () => {
  it('shows a fully approved session and its option to an anonymous visitor', async () => {
    await withApprovedSession(async (ids) => {
      for (const [table, id] of chainRows(ids, ids.optionId)) {
        expect(await isVisible(anonClient(), table, id), table).toBe(true);
      }
    });
  });

  // A status-only change is allowed outside the gate: it unpublishes, never
  // publishes. It is the way to put a verified parent back to draft.
  it.each([
    ['camp', 'camps', 'campId'],
    ['provider', 'providers', 'providerId'],
    ['location', 'locations', 'locationId'],
  ] as const)('hides a verified session whose %s is back in draft', async (_kind, table, key) => {
    await withApprovedSession(async (ids, admin) => {
      const { error } = await admin.from(table).update({ status: 'draft' }).eq('id', ids[key]);
      expect(error).toBeNull();

      expect(await isVisible(anonClient(), 'sessions', ids.sessionId)).toBe(false);
      expect(await isVisible(anonClient(), 'session_options', ids.optionId)).toBe(false);
    });
  });

  // search_sessions applies the same chain rule itself (it runs as definer, so
  // its date and category indexes work); these keep it in step with the
  // policies.
  it('finds a fully approved session through search, as an anonymous visitor', async () => {
    await withApprovedSession(async (ids) => {
      expect(await searchHits(anonClient(), ids.sessionId)).toBe(true);
    });
  });

  it('drops a session from search once its camp is back in draft', async () => {
    await withApprovedSession(async (ids, admin) => {
      await admin.from('camps').update({ status: 'draft' }).eq('id', ids.campId);
      expect(await searchHits(anonClient(), ids.sessionId)).toBe(false);
    });
  });

  it('shows an approved calendar and its closures', async () => {
    await withDraftCalendar(async ({ calendarId, closureId }) => {
      await approve(reviewer, 'school_calendar', calendarId);
      expect(await isVisible(anonClient(), 'school_calendars', calendarId)).toBe(true);
      expect(await isVisible(anonClient(), 'school_closures', closureId)).toBe(true);
    });
  });
});

// ------------------------------------------------------------------ approval

describe('approve_record', () => {
  it.each(NON_REVIEWERS)('refuses %s', async (_who, clientFor) => {
    await withCampAndLocation(async ({ providerId }, admin) => {
      const { error } = await clientFor().rpc('approve_record', {
        record_kind: 'provider',
        record_id: providerId,
      });
      expect(error?.code).toBe('42501');

      const after = await admin.from('providers').select('status').eq('id', providerId).single();
      expect(after.data?.status).toBe('draft');
    });
  });

  it('marks the row verified, with the reviewer’s name and the time', async () => {
    await withCampAndLocation(async ({ providerId }, admin) => {
      await approve(reviewer, 'provider', providerId);

      const { data } = await admin
        .from('providers')
        .select('status, verified_at, verified_by')
        .eq('id', providerId)
        .single();
      expect(data?.status).toBe('verified');
      expect(data?.verified_at).not.toBeNull();
      expect(data?.verified_by).toBe('Reviewer catalog-review-reviewer');
    });
  });

  it.each([
    ['camp', 'P0002'],
    ['session', 'P0002'],
    ['provider', 'P0002'],
  ])('reports a %s that does not exist as missing', async (kind, code) => {
    const { error } = await reviewer.client.rpc('approve_record', {
      record_kind: kind,
      record_id: '00000000-0000-4000-8000-00000000dead',
    });
    expect(error?.code).toBe(code);
  });

  it.each(['session_option', 'school_closure'])(
    'refuses to approve a %s, which follows its parent',
    async (kind) => {
      const { error } = await reviewer.client.rpc('approve_record', {
        record_kind: kind,
        record_id: '00000000-0000-4000-8000-00000000dead',
      });
      expect(error?.code).toBe('22023');
    },
  );

  it('refuses a camp whose provider is a draft', async () => {
    await withCampAndLocation(async ({ campId }) => {
      const { error } = await reviewer.client.rpc('approve_record', {
        record_kind: 'camp',
        record_id: campId,
      });
      expect(error?.code).toBe('55000');
    });
  });

  it.each([
    ['its camp is a draft', ['provider', 'location']],
    ['its location is a draft', ['provider', 'camp']],
  ])('refuses a session when %s', async (_case, approved) => {
    await withSeededSession(async (ids, admin) => {
      await insertId(admin, 'session_options', optionRow(ids.sessionId));
      const idOf = new Map([
        ['provider', ids.providerId],
        ['camp', ids.campId],
        ['location', ids.locationId],
      ]);
      for (const kind of approved) await approve(reviewer, kind, idOf.get(kind) as string);

      const { error } = await reviewer.client.rpc('approve_record', {
        record_kind: 'session',
        record_id: ids.sessionId,
      });
      expect(error?.code).toBe('55000');
    });
  });

  // ADR-0018: one to three options is the shape; zero can't be a constraint.
  it('refuses a session with no options', async () => {
    await withSeededSession(async (ids) => {
      await approve(reviewer, 'provider', ids.providerId);
      await approve(reviewer, 'location', ids.locationId);
      await approve(reviewer, 'camp', ids.campId);

      const { error } = await reviewer.client.rpc('approve_record', {
        record_kind: 'session',
        record_id: ids.sessionId,
      });
      expect(error?.code).toBe('55000');
    });
  });

  // Most camps run one week, occasionally two. Longer is usually a weekly class
  // or a mistyped end date, so the reviewer has to say they checked.
  it('refuses a session over two weeks until the reviewer confirms it', async () => {
    await withCampAndLocation(async ({ providerId, campId, locationId }, admin) => {
      const sessionId = await insertId(
        admin,
        'sessions',
        sessionRow(campId, locationId, { start_date: '2027-06-07', end_date: '2027-06-21' }),
      );
      await insertId(admin, 'session_options', optionRow(sessionId));
      await approve(reviewer, 'provider', providerId);
      await approve(reviewer, 'location', locationId);
      await approve(reviewer, 'camp', campId);

      const unconfirmed = await reviewer.client.rpc('approve_record', {
        record_kind: 'session',
        record_id: sessionId,
      });
      expect(unconfirmed.error?.code).toBe('55000');

      await approve(reviewer, 'session', sessionId, true);
    });
  });
});

// --------------------------------------------------------------------- guard

describe('the guard trigger', () => {
  it('refuses a secret-key insert of a row that is already verified', async () => {
    const { error } = await serviceClient()
      .from('providers')
      .insert({
        name: 'Pre-verified',
        ...PROVENANCE,
        status: 'verified',
        verified_at: '2026-09-01T00:00:00Z',
        verified_by: 'script',
      });
    expect(error?.code).toBe('42501');
  });

  it.each([
    ['marks a draft verified', { status: 'verified' }],
    ['records a verifier on a draft', { verified_by: 'script' }],
  ])('refuses a secret-key update that %s', async (_case, change) => {
    await withCampAndLocation(async ({ providerId }, admin) => {
      const { error } = await admin.from('providers').update(change).eq('id', providerId);
      expect(error?.code).toBe('42501');
    });
  });

  it('leaves drafts freely editable', async () => {
    await withSeededSession(async ({ sessionId }, admin) => {
      const { error } = await admin
        .from('sessions')
        .update({ theme: 'Space Week' })
        .eq('id', sessionId);
      expect(error).toBeNull();
    });
  });

  // Every direct secret-key write that would change what parents see of a
  // verified session. Archive, don't delete: a delete unpublishes as surely as
  // an edit.
  it.each([
    [
      'an edit to its facts',
      (admin: SupabaseClient, ids: ApprovedSession) =>
        admin.from('sessions').update({ end_date: '2027-07-15' }).eq('id', ids.sessionId),
    ],
    [
      'an edit to one of its options',
      (admin: SupabaseClient, ids: ApprovedSession) =>
        admin.from('session_options').update({ price_cents: 1 }).eq('id', ids.optionId),
    ],
    [
      'removing one of its options',
      (admin: SupabaseClient, ids: ApprovedSession) =>
        admin.from('session_options').delete().eq('id', ids.optionId),
    ],
    [
      'a new option',
      (admin: SupabaseClient, ids: ApprovedSession) =>
        admin.from('session_options').insert(optionRow(ids.sessionId, { kind: 'afternoon' })),
    ],
    [
      'deleting it',
      (admin: SupabaseClient, ids: ApprovedSession) =>
        admin.from('sessions').delete().eq('id', ids.sessionId),
    ],
    [
      'deleting its provider',
      (admin: SupabaseClient, ids: ApprovedSession) =>
        admin.from('providers').delete().eq('id', ids.providerId),
    ],
  ])('refuses %s once a session is verified', async (_case, attempt) => {
    await withApprovedSession(async (ids, admin) => {
      const { error } = await attempt(admin, ids);
      expect(error?.code).toBe('42501');
    });
  });

  it.each([
    [
      'an edit to a closure',
      (admin: SupabaseClient, ids: CalendarIds) =>
        admin.from('school_closures').update({ end_date: '2098-09-08' }).eq('id', ids.closureId),
    ],
    [
      'a new closure',
      (admin: SupabaseClient, ids: CalendarIds) =>
        admin.from('school_closures').insert({
          calendar_id: ids.calendarId,
          start_date: '2098-11-26',
          end_date: '2098-11-26',
          source_label: 'Holiday',
        }),
    ],
    [
      'removing a closure',
      (admin: SupabaseClient, ids: CalendarIds) =>
        admin.from('school_closures').delete().eq('id', ids.closureId),
    ],
  ])('refuses %s on a verified calendar', async (_case, attempt) => {
    await withApprovedCalendar(async (ids, admin) => {
      const { error } = await attempt(admin, ids);
      expect(error?.code).toBe('42501');
    });
  });

  it('lets a verified row be archived', async () => {
    await withApprovedSession(async ({ sessionId }, admin) => {
      const { error } = await admin
        .from('sessions')
        .update({ status: 'archived' })
        .eq('id', sessionId);
      expect(error).toBeNull();
    });
  });

  it.skipIf(isLiveProject())(
    'refuses a verified row without its verifier, even with the gate open',
    () => {
      expect(() =>
        runSql(`
        begin;
        select set_config('campout.catalog_gate', 'on', true);
        insert into providers (name, source_url, status)
          values ('No verifier', 'https://example.test', 'verified');
        rollback;
      `),
      ).toThrow(/providers_verified_recorded/);
    },
  );
});

// ------------------------------------------------------------- reviewer edit

describe('reviewer_edit', () => {
  // Each edit lands and the row stays verified (decision 13). Options have no
  // status of their own; their session stays verified.
  it.each([
    ['session', 'sessions', 'sessionId', { theme: 'Ocean Week', end_date: '2027-07-15' }],
    ['session_option', 'session_options', 'optionId', { price_cents: 30000 }],
    ['provider', 'providers', 'providerId', { phone: '804-555-0199' }],
    ['camp', 'camps', 'campId', { summary: 'Corrected summary.' }],
    ['location', 'locations', 'locationId', { label: 'Fixture Community Center, east gym' }],
  ] as const)(
    'edits a verified %s and keeps the chain verified',
    async (kind, table, key, changes) => {
      await withApprovedSession(async (ids, admin) => {
        expect(await editAsReviewer(kind, ids[key], changes)).toBeNull();
        expect(await readRow(admin, table, ids[key])).toMatchObject(changes);
        expect(await readRow(admin, 'sessions', ids.sessionId)).toMatchObject({
          status: 'verified',
        });
      });
    },
  );

  it.each([
    ['school_calendar', 'school_calendars', 'calendarId', { label: '2098-99b' }],
    ['school_closure', 'school_closures', 'closureId', { common_name: 'Labor Day' }],
  ] as const)('edits a verified calendar’s %s', async (kind, table, key, changes) => {
    await withApprovedCalendar(async (ids, admin) => {
      expect(await editAsReviewer(kind, ids[key], changes)).toBeNull();
      expect(await readRow(admin, table, ids[key])).toMatchObject(changes);
      expect(await readRow(admin, 'school_calendars', ids.calendarId)).toMatchObject({
        status: 'verified',
      });
    });
  });

  // Each kind's fact columns are written three times in the migration: the
  // editable_columns() list and reviewer_edit()'s SET and SELECT lists. This
  // ties the list to the table, so a new column can't be quietly left out.
  it.skipIf(isLiveProject())('lists every column of each table as a fact, or as maintained', () => {
    const out = runSql(`
      with kinds(kind, tbl, maintained) as (values
        ('provider', 'providers', '{id,status,verified_at,verified_by,created_at,updated_at}'),
        ('camp', 'camps', '{id,status,verified_at,verified_by,created_at,updated_at}'),
        ('location', 'locations', '{id,status,verified_at,verified_by,created_at,address_key}'),
        ('session', 'sessions', '{id,status,verified_at,verified_by,created_at,updated_at}'),
        ('session_option', 'session_options', '{id,session_id,created_at,updated_at}'),
        ('school_calendar', 'school_calendars', '{id,status,verified_at,verified_by}'),
        ('school_closure', 'school_closures', '{id,calendar_id}'))
      select k.kind || ':' || coalesce(string_agg(c.column_name, ',' order by c.column_name), '')
      from kinds k
      left join information_schema.columns c
        on c.table_schema = 'public' and c.table_name = k.tbl
       and c.column_name <> all (k.maintained::text[])
       and c.column_name <> all (editable_columns(k.kind::catalog_record_kind))
      group by k.kind order by k.kind;
    `);
    // Every kind prints "kind:" with nothing after it: no column left unlisted.
    const unlisted = out
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes(':') && !line.endsWith(':'));
    expect(unlisted).toEqual([]);
  });

  it('refuses a non-reviewer', async () => {
    await withApprovedSession(async (ids) => {
      const { error } = await parent.client.rpc('reviewer_edit', {
        record_kind: 'session',
        record_id: ids.sessionId,
        changes: { theme: 'Hijacked' },
      });
      expect(error?.code).toBe('42501');
    });
  });

  it.each([
    ['its status', { status: 'draft' }],
    ['its verifier', { verified_by: 'someone else' }],
    ['its id', { id: '00000000-0000-4000-8000-000000000999' }],
    ['a column it does not have', { colour: 'red' }],
  ])('refuses an edit to %s', async (_case, changes) => {
    await withApprovedSession(async (ids) => {
      expect((await editAsReviewer('session', ids.sessionId, changes))?.code).toBe('22023');
    });
  });

  it('still applies every check constraint', async () => {
    await withApprovedSession(async (ids) => {
      const error = await editAsReviewer('session', ids.sessionId, { end_date: '2027-07-01' });
      expect(error?.code).toBe('23514');
    });
  });
});

// ------------------------------------------------------------------- history

interface HistoryRow {
  action: string;
  changed_by: string | null;
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
}

async function historyOf(client: SupabaseClient, rowId: string): Promise<HistoryRow[]> {
  const { data, error } = await client
    .from('catalog_history')
    .select('action, changed_by, old_row, new_row')
    .eq('row_id', rowId)
    .order('id');
  expect(error).toBeNull();
  return (data ?? []) as HistoryRow[];
}

describe('catalog_history', () => {
  it('records an insert, an update and a delete, with the old and new row', async () => {
    await withCampAndLocation(async ({ campId }, admin) => {
      await admin.from('camps').update({ name: 'Renamed Camp' }).eq('id', campId);
      await admin.from('camps').delete().eq('id', campId);

      const history = await historyOf(admin, campId);
      expect(history.map((row) => row.action)).toEqual(['insert', 'update', 'delete']);
      expect(history[1]?.old_row?.name).toBe('Fixture Day Camp');
      expect(history[1]?.new_row?.name).toBe('Renamed Camp');
      expect(history[2]?.new_row).toBeNull();
    });
  });

  it('records the reviewer who approved a row', async () => {
    await withCampAndLocation(async ({ providerId }, admin) => {
      await approve(reviewer, 'provider', providerId);
      const history = await historyOf(admin, providerId);
      expect(history.at(-1)?.changed_by).toBe(reviewer.id);
      expect(history.at(-1)?.new_row?.status).toBe('verified');
    });
  });

  it.each(NON_REVIEWERS)('shows %s no history at all', async (_who, clientFor) => {
    await withCampAndLocation(async ({ providerId }) => {
      expect(await historyOf(clientFor(), providerId)).toEqual([]);
    });
  });

  it('is readable by reviewers', async () => {
    await withCampAndLocation(async ({ providerId }) => {
      expect((await historyOf(reviewer.client, providerId)).length).toBeGreaterThan(0);
    });
  });
});

// --------------------------------------------------------------------- plans

interface Family {
  householdId: string;
  childId: string;
}

async function familyOf(user: TestUser, name: string): Promise<Family> {
  const householdId = await createHousehold(user, name);
  const { data, error } = await user.client
    .from('children')
    .insert({ household_id: householdId, display_name: 'Sam', age_years: 8, grade: 3 })
    .select('id')
    .single();
  if (error) throw new Error(`Could not add a child: ${error.message}`);
  return { householdId, childId: (data as { id: string }).id };
}

let family: Family;
let otherFamily: Family;

/**
 * A fully approved session with one option, for a plan to reference. Plan
 * entries go before the fixture's cleanup, which a referenced session would
 * otherwise refuse.
 */
async function withPlannableSession(
  assert: (ids: ApprovedSession, admin: SupabaseClient) => Promise<void>,
): Promise<void> {
  await withApprovedSession(async (ids, admin) => {
    try {
      await assert(ids, admin);
    } finally {
      await admin.from('plan_entries').delete().eq('session_id', ids.sessionId);
    }
  });
}

function planEntry(who: Family, sessionId: string, optionId: string, childId = who.childId) {
  return {
    household_id: who.householdId,
    child_id: childId,
    session_id: sessionId,
    option_id: optionId,
  };
}

describe('plans', () => {
  beforeAll(async () => {
    family = await familyOf(parent, 'Review Gate Family');
    otherFamily = await familyOf(otherParent, 'Other Review Gate Family');
  });

  it('lets a household plan a verified session option', async () => {
    await withPlannableSession(async ({ sessionId, optionId }) => {
      const { error } = await parent.client
        .from('plan_entries')
        .insert(planEntry(family, sessionId, optionId));
      expect(error).toBeNull();
    });
  });

  it('refuses a draft session', async () => {
    await withSeededSession(async ({ sessionId }, admin) => {
      const optionId = await insertId(admin, 'session_options', optionRow(sessionId));
      const { error } = await parent.client
        .from('plan_entries')
        .insert(planEntry(family, sessionId, optionId));
      expect(error?.code).toBe('42501');
    });
  });

  it('refuses another household’s child', async () => {
    await withPlannableSession(async ({ sessionId, optionId }) => {
      const { error } = await parent.client
        .from('plan_entries')
        .insert(planEntry(family, sessionId, optionId, otherFamily.childId));
      expect(error?.code).toBe('42501');
    });
  });

  it('refuses an option from another session', async () => {
    await withPlannableSession(async ({ campId, locationId, sessionId }, admin) => {
      const otherSession = await insertId(
        admin,
        'sessions',
        sessionRow(campId, locationId, { start_date: '2027-07-19', end_date: '2027-07-23' }),
      );
      const otherOption = await insertId(admin, 'session_options', optionRow(otherSession));

      const { error } = await parent.client
        .from('plan_entries')
        .insert(planEntry(family, sessionId, otherOption));
      expect(error?.code).toBe('23503');
    });
  });

  it('keeps an archived chain readable to the household that planned it, and nobody else', async () => {
    await withPlannableSession(async (ids, admin) => {
      await parent.client
        .from('plan_entries')
        .insert(planEntry(family, ids.sessionId, ids.optionId));
      await admin.from('sessions').update({ status: 'archived' }).eq('id', ids.sessionId);
      await admin.from('camps').update({ status: 'archived' }).eq('id', ids.campId);
      await admin.from('providers').update({ status: 'archived' }).eq('id', ids.providerId);
      await admin.from('locations').update({ status: 'archived' }).eq('id', ids.locationId);

      for (const [table, id] of chainRows(ids, ids.optionId)) {
        expect(await isVisible(parent.client, table, id), `${table} to the planner`).toBe(true);
        expect(await isVisible(otherParent.client, table, id), `${table} to others`).toBe(false);
        expect(await isVisible(anonClient(), table, id), `${table} to anon`).toBe(false);
      }
    });
  });

  // Decision 15's "no longer listed" read is for the family's grid, not the
  // directory: an archived session they planned is not a search result.
  it('leaves an archived planned session out of the planner’s search', async () => {
    await withPlannableSession(async ({ sessionId, optionId }, admin) => {
      await parent.client.from('plan_entries').insert(planEntry(family, sessionId, optionId));
      await admin.from('sessions').update({ status: 'archived' }).eq('id', sessionId);
      expect(await searchHits(parent.client, sessionId)).toBe(false);
    });
  });

  // Archived first, so the guard (which refuses deleting a verified row) lets
  // the delete through to the foreign key.
  it('refuses to delete a session a plan references', async () => {
    await withPlannableSession(async ({ sessionId, optionId }, admin) => {
      await parent.client.from('plan_entries').insert(planEntry(family, sessionId, optionId));
      await admin.from('sessions').update({ status: 'archived' }).eq('id', sessionId);
      const { error } = await admin.from('sessions').delete().eq('id', sessionId);
      expect(error?.code).toBe('23503');
    });
  });

  // Archived first, as above.
  it('refuses to delete an option a plan references', async () => {
    await withPlannableSession(async ({ sessionId, optionId }, admin) => {
      await parent.client.from('plan_entries').insert(planEntry(family, sessionId, optionId));
      await admin.from('sessions').update({ status: 'archived' }).eq('id', sessionId);
      const { error } = await admin.from('session_options').delete().eq('id', optionId);
      expect(error?.code).toBe('23503');
    });
  });
});

// -------------------------------------------------------------------- shape

describe('evidence and verification', () => {
  it('requires evidence on a location', async () => {
    const { error } = await serviceClient()
      .from('locations')
      .insert({ ...LOCATION, source_url: null });
    expect(error?.code).toBe('23514');
  });

  it('accepts a draft with no verifier yet', async () => {
    await withCampAndLocation(async ({ providerId }, admin) => {
      const { data } = await admin
        .from('providers')
        .select('status, verified_at, verified_by')
        .eq('id', providerId)
        .single();
      expect(data).toEqual({ status: 'draft', verified_at: null, verified_by: null });
    });
  });
});
