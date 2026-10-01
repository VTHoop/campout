import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { campRow, PROVENANCE, sessionRow, withCampAndLocation } from './catalog-fixtures';
import type { TestUser } from './helpers';
import { anonClient, createTestUser, deleteTestUsers, serviceClient } from './helpers';

/**
 * Catalog RLS (ADR-0004).
 *
 * The catalog is the public half: world-readable, writable only by the service
 * role. RLS is enabled on these tables anyway, so the permissive read is an
 * explicit policy somebody reviewed rather than an absence nobody noticed.
 *
 * What these tests pin is the *write* side. No insert, update, or delete policy
 * exists, so a normal client cannot change the catalog at all — which is what
 * makes "every record is verified by a human before it goes live" true in the
 * database rather than only in the terms.
 *
 * The rows follow the provider → camp → session shape (CAM-27): a provider is
 * the organization, a camp is a program it runs, and registration lives on the
 * camp. The shape's own rules are pinned in catalog-shape.rls.test.ts.
 */

const CAMP_NAME = 'Fixture Day Camp';

/**
 * A school year far enough out that no real calendar will ever collide with it.
 * Provenance is deliberately left off: each test adds the evidence it is about.
 */
const CALENDAR = {
  district: 'hanover',
  type: 'traditional',
  label: '2099-00',
  first_instructional_day: '2099-08-24',
  last_instructional_day: '2100-06-11',
  covers_from: '2099-07-01',
  covers_to: '2100-06-30',
};

const CALENDAR_SOURCE = { source_url: 'https://example.test/calendar' };

describe('catalog reads', () => {
  it('lets an anonymous visitor read camps', async () => {
    const { error } = await anonClient().from('camps').select('id').limit(1);
    expect(error).toBeNull();
  });

  it('lets an anonymous visitor read sessions', async () => {
    const { error } = await anonClient().from('sessions').select('id').limit(1);
    expect(error).toBeNull();
  });

  it('lets an anonymous visitor read school calendars', async () => {
    const { error } = await anonClient().from('school_calendars').select('district').limit(1);
    expect(error).toBeNull();
  });

  it('lets an anonymous visitor read school closures', async () => {
    const { error } = await anonClient().from('school_closures').select('id').limit(1);
    expect(error).toBeNull();
  });
});

describe('catalog writes are closed to clients', () => {
  it('refuses an anonymous insert', async () => {
    await withCampAndLocation(async ({ providerId }) => {
      const { error } = await anonClient().from('camps').insert(campRow(providerId));
      expect(error).not.toBeNull();
    });
  });

  it('refuses an anonymous insert of a provider', async () => {
    const { error } = await anonClient()
      .from('providers')
      .insert({ name: 'Hijacked', ...PROVENANCE });
    expect(error).not.toBeNull();
  });

  // Update and delete share one assertion because they share one rule: a client
  // write against the catalog matches no rows, so it reports no error and changes
  // nothing. Checking the error alone would pass even if the write had landed —
  // the record has to be read back.
  it.each([
    [
      'update',
      (campId: string) => anonClient().from('camps').update({ name: 'Hijacked' }).eq('id', campId),
    ],
    ['delete', (campId: string) => anonClient().from('camps').delete().eq('id', campId)],
  ])('leaves the record untouched after an anonymous %s', async (_verb, attempt) => {
    // withCampAndLocation cleans up in a `finally`, so a failing assertion still
    // leaves the tables as it found them.
    await withCampAndLocation(async ({ campId }, admin) => {
      const { error } = await attempt(campId);
      expect(error).toBeNull();

      const after = await admin.from('camps').select('id, name').eq('id', campId);
      expect(after.data).toEqual([{ id: campId, name: CAMP_NAME }]);
    });
  });
});

describe('provenance is required, but need not be a URL', () => {
  // A camp with no web presence at all — the case the schema used to reject.
  // source_document_path is an object key inside the camp-sources bucket, with no
  // bucket prefix. Nothing is uploaded here on purpose: the constraint checks only
  // that one evidence column is non-null, and a test that uploaded a real file
  // would be asserting something the database does not promise.
  it('accepts a camp with no source URL, evidenced by a stored document', async () => {
    await withCampAndLocation(async ({ providerId }, admin) => {
      const { error } = await admin.from('camps').insert(
        campRow(providerId, {
          name: 'Parish Hall Soccer Week',
          source_url: null,
          source_document_path: 'parish-hall-2027-flyer.jpg',
          registration_url: null,
          registration_note: 'Paper form at the parish office',
        }),
      );
      expect(error).toBeNull();
    });
  });

  it('rejects a camp with neither a source URL nor a stored document', async () => {
    await withCampAndLocation(async ({ providerId }, admin) => {
      const { error } = await admin
        .from('camps')
        .insert(campRow(providerId, { name: 'Unevidenced', source_url: null }));

      // A claim with nothing behind it is not evidence. The check constraint makes
      // that a shape rule rather than a habit somebody has to keep.
      expect(error?.code).toBe('23514');
    });
  });

  // A verifier is recorded by approve_record() alone (ADR-0017 §3). A row that
  // claims one on its way in is refused, even from the secret key.
  it('rejects a camp that names its own verifier, however good its source', async () => {
    await withCampAndLocation(async ({ providerId }, admin) => {
      const { error } = await admin
        .from('camps')
        .insert(campRow(providerId, { name: 'Self-verified', verified_by: 'rls-suite' }));

      expect(error?.code).toBe('42501');
    });
  });

  // A parent has to be told how to sign up, one way or the other. Registration
  // moved from the session to the camp (CAM-27 decision 10).
  it('rejects a camp with no registration link and no instructions', async () => {
    await withCampAndLocation(async ({ providerId }, admin) => {
      const { error } = await admin
        .from('camps')
        .insert(campRow(providerId, { registration_url: null }));

      expect(error?.code).toBe('23514');
    });
  });
});

describe('sessions carry their own provenance', () => {
  it('accepts a session evidenced by a stored document', async () => {
    await withCampAndLocation(async ({ campId, locationId }, admin) => {
      const { error } = await admin.from('sessions').insert(
        sessionRow(campId, locationId, {
          source_url: null,
          source_document_path: 'parish-hall-2027-flyer.jpg',
        }),
      );

      expect(error).toBeNull();
    });
  });

  it('rejects a session with neither a source URL nor a stored document', async () => {
    await withCampAndLocation(async ({ campId, locationId }, admin) => {
      const { error } = await admin
        .from('sessions')
        .insert(sessionRow(campId, locationId, { source_url: null }));

      expect(error?.code).toBe('23514');
    });
  });
});

describe('school calendars carry their own provenance', () => {
  async function cleanUpCalendar(): Promise<void> {
    await serviceClient()
      .from('school_calendars')
      .delete()
      .eq('district', CALENDAR.district)
      .eq('label', CALENDAR.label);
  }

  it('accepts a calendar evidenced by a stored document', async () => {
    try {
      const { error } = await serviceClient()
        .from('school_calendars')
        .insert({ ...CALENDAR, source_document_path: 'hanover-2027-calendar.pdf' });

      expect(error).toBeNull();
    } finally {
      await cleanUpCalendar();
    }
  });

  it('rejects a calendar with neither a source URL nor a stored document', async () => {
    try {
      const { error } = await serviceClient().from('school_calendars').insert(CALENDAR);
      expect(error).not.toBeNull();
    } finally {
      await cleanUpCalendar();
    }
  });

  // The district calendar drives every coverage gap for every family in it, so it
  // is held to the same verifier rule as a camp: only approval records one.
  it('rejects a calendar that names its own verifier', async () => {
    try {
      const { error } = await serviceClient()
        .from('school_calendars')
        .insert({
          ...CALENDAR,
          ...CALENDAR_SOURCE,
          verified_at: '2026-09-01T00:00:00Z',
          verified_by: 'rls-suite',
        });

      expect(error?.code).toBe('42501');
    } finally {
      await cleanUpCalendar();
    }
  });
});

/**
 * Insert a calendar as the service role and hand back its id (or the error), so a
 * test can assert on a constraint and still clean up whatever did get through.
 */
async function insertCalendar(overrides: Record<string, unknown> = {}) {
  const { data, error } = await serviceClient()
    .from('school_calendars')
    .insert({ ...CALENDAR, ...CALENDAR_SOURCE, ...overrides })
    .select('id')
    .single();
  return { id: data?.id as string | undefined, error };
}

async function removeCalendar(id: string | undefined): Promise<void> {
  if (id) await serviceClient().from('school_calendars').delete().eq('id', id);
}

/** Seed a calendar, run an assertion against it, then remove it — closures cascade. */
async function withSeededCalendar(
  assert: (calendarId: string, admin: SupabaseClient) => Promise<void>,
): Promise<void> {
  const seeded = await insertCalendar();
  expect(seeded.error).toBeNull();

  try {
    await assert(seeded.id as string, serviceClient());
  } finally {
    await removeCalendar(seeded.id);
  }
}

/** An inclusive run of days. A single day repeats itself. */
interface Days {
  start: string;
  end: string;
}

const LABOR_DAY: Days = { start: '2099-09-07', end: '2099-09-07' };
const ELECTION_DAY: Days = { start: '2099-11-05', end: '2099-11-05' };
const WINTER_BREAK: Days = { start: '2099-12-21', end: '2100-01-01' };
const WINTER_BREAK_OVERLAP: Days = { start: '2099-12-31', end: '2100-01-04' };
const BEFORE_NEW_YEAR: Days = { start: '2099-12-21', end: '2099-12-31' };
const NEW_YEARS_DAY: Days = { start: '2100-01-01', end: '2100-01-01' };
const ENDS_BEFORE_IT_STARTS: Days = { start: '2099-09-08', end: '2099-09-07' };

function closureRow(calendarId: string, days: Days, extra = {}) {
  return {
    calendar_id: calendarId,
    start_date: days.start,
    end_date: days.end,
    source_label: 'Holiday, schools and offices closed',
    ...extra,
  };
}

/** Insert a closure as the service role and return the result, so a test can assert on it. */
function addClosure(admin: SupabaseClient, calendarId: string, days: Days, extra = {}) {
  return admin.from('school_closures').insert(closureRow(calendarId, days, extra));
}

/** Insert a closure that must succeed, so a test cannot pass on a failed setup. */
async function seedClosure(admin: SupabaseClient, calendarId: string, days: Days): Promise<string> {
  const seeded = await addClosure(admin, calendarId, days).select('id').single();
  expect(seeded.error).toBeNull();
  return seeded.data?.id as string;
}

/**
 * The catalog has no write policy for any role, so a signed-in parent — the
 * realistic threat — must fare exactly like an anonymous visitor. The table runs
 * both, so a policy written for one and forgotten for the other shows up here.
 */
let parent: TestUser;

beforeAll(async () => {
  parent = await createTestUser('catalog-parent');
});

afterAll(async () => {
  await deleteTestUsers([parent]);
});

describe.each([
  ['an anonymous visitor', () => anonClient()],
  ['a signed-in user', () => parent.client],
])('school calendars and closures are closed to %s', (_who, clientFor) => {
  it('refuses an insert of a calendar', async () => {
    try {
      const { error } = await clientFor()
        .from('school_calendars')
        .insert({ ...CALENDAR, ...CALENDAR_SOURCE });
      expect(error).not.toBeNull();
    } finally {
      await serviceClient()
        .from('school_calendars')
        .delete()
        .eq('district', CALENDAR.district)
        .eq('label', CALENDAR.label);
    }
  });

  it('refuses an insert of a closure', async () => {
    await withSeededCalendar(async (calendarId) => {
      const { error } = await addClosure(clientFor(), calendarId, LABOR_DAY);
      expect(error).not.toBeNull();
    });
  });

  // As with the camps: a client write matches no rows, so it reports no error and
  // changes nothing. The record has to be read back to know it survived.
  it.each([
    [
      'update',
      (client: SupabaseClient, calendarId: string) =>
        client.from('school_calendars').update({ label: 'Hijacked' }).eq('id', calendarId),
    ],
    [
      'delete',
      (client: SupabaseClient, calendarId: string) =>
        client.from('school_calendars').delete().eq('id', calendarId),
    ],
  ])('leaves a calendar untouched after an %s', async (_verb, attempt) => {
    await withSeededCalendar(async (calendarId, admin) => {
      const { error } = await attempt(clientFor(), calendarId);
      expect(error).toBeNull();

      const after = await admin.from('school_calendars').select('id, label').eq('id', calendarId);
      expect(after.data).toEqual([{ id: calendarId, label: CALENDAR.label }]);
    });
  });

  it.each([
    [
      'update',
      (client: SupabaseClient, closureId: string) =>
        client.from('school_closures').update({ source_label: 'Hijacked' }).eq('id', closureId),
    ],
    [
      'delete',
      (client: SupabaseClient, closureId: string) =>
        client.from('school_closures').delete().eq('id', closureId),
    ],
  ])('leaves a closure untouched after an %s', async (_verb, attempt) => {
    await withSeededCalendar(async (calendarId, admin) => {
      const closureId = await seedClosure(admin, calendarId, LABOR_DAY);

      const { error } = await attempt(clientFor(), closureId);
      expect(error).toBeNull();

      const after = await admin
        .from('school_closures')
        .select('id, source_label')
        .eq('id', closureId);
      expect(after.data).toEqual([
        { id: closureId, source_label: 'Holiday, schools and offices closed' },
      ]);
    });
  });
});

describe('school closures', () => {
  it('accepts a single day, which repeats its start date', async () => {
    await withSeededCalendar(async (calendarId, admin) => {
      const { error } = await addClosure(admin, calendarId, LABOR_DAY);
      expect(error).toBeNull();
    });
  });

  it('keeps a set of tags, since one closure can carry several facts', async () => {
    await withSeededCalendar(async (calendarId, admin) => {
      const seeded = await addClosure(admin, calendarId, ELECTION_DAY, {
        tags: ['holiday', 'conference_day'],
      })
        .select('tags')
        .single();
      expect(seeded.error).toBeNull();
      expect(seeded.data?.tags).toEqual(['holiday', 'conference_day']);
    });
  });

  it('defaults to no tags rather than a guessed one', async () => {
    await withSeededCalendar(async (calendarId, admin) => {
      const seeded = await addClosure(admin, calendarId, LABOR_DAY).select('tags').single();
      expect(seeded.data?.tags).toEqual([]);
    });
  });

  it('rejects a tag outside the closure_tag enum', async () => {
    await withSeededCalendar(async (calendarId, admin) => {
      const { error } = await addClosure(admin, calendarId, LABOR_DAY, {
        tags: ['snow_day'],
      });
      expect(error).not.toBeNull();
    });
  });

  it('rejects a closure that ends before it starts', async () => {
    await withSeededCalendar(async (calendarId, admin) => {
      const { error } = await addClosure(admin, calendarId, ENDS_BEFORE_IT_STARTS);
      expect(error).not.toBeNull();
    });
  });

  it('requires the district’s own words', async () => {
    await withSeededCalendar(async (calendarId, admin) => {
      const { error } = await admin
        .from('school_closures')
        .insert({ calendar_id: calendarId, start_date: '2099-09-07', end_date: '2099-09-07' });
      expect(error).not.toBeNull();
    });
  });

  // Two rows both claiming December 21st starts winter break is a data-entry
  // mistake, and it would double-count a gap. 23P01 is exclusion_violation.
  it('rejects two closures that cover the same day in one calendar', async () => {
    await withSeededCalendar(async (calendarId, admin) => {
      await seedClosure(admin, calendarId, WINTER_BREAK);

      const { error } = await addClosure(admin, calendarId, WINTER_BREAK_OVERLAP);
      expect(error?.code).toBe('23P01');
    });
  });

  it('counts the end date as covered, so sharing only a last day still collides', async () => {
    await withSeededCalendar(async (calendarId, admin) => {
      await seedClosure(admin, calendarId, WINTER_BREAK);

      const { error } = await addClosure(admin, calendarId, NEW_YEARS_DAY);
      expect(error?.code).toBe('23P01');
    });
  });

  it('accepts closures that sit back to back without sharing a day', async () => {
    await withSeededCalendar(async (calendarId, admin) => {
      await seedClosure(admin, calendarId, BEFORE_NEW_YEAR);

      const { error } = await addClosure(admin, calendarId, NEW_YEARS_DAY);
      expect(error).toBeNull();
    });
  });

  // The constraint is scoped to one calendar. Two districts close on the same day
  // all the time, and that is not a collision.
  it('accepts the same dates in a different calendar', async () => {
    await withSeededCalendar(async (calendarId, admin) => {
      await seedClosure(admin, calendarId, LABOR_DAY);

      const other = await insertCalendar({ label: '2099-00-other', school: 'Fixture Elementary' });
      try {
        expect(other.error).toBeNull();
        const { error } = await addClosure(admin, other.id as string, LABOR_DAY);
        expect(error).toBeNull();
      } finally {
        await removeCalendar(other.id);
      }
    });
  });

  it('is removed with its calendar', async () => {
    const seeded = await insertCalendar();
    expect(seeded.error).toBeNull();
    const admin = serviceClient();

    await seedClosure(admin, seeded.id as string, LABOR_DAY);
    await removeCalendar(seeded.id);

    const after = await admin
      .from('school_closures')
      .select('id')
      .eq('calendar_id', seeded.id as string);
    expect(after.data).toEqual([]);
  });
});

describe('school calendar shape', () => {
  it('rejects a last instructional day that is not after the first', async () => {
    const { id, error } = await insertCalendar({ last_instructional_day: '2099-08-24' });
    await removeCalendar(id);
    expect(error).not.toBeNull();
  });

  it('rejects a coverage window that ends on or before it starts', async () => {
    const { id, error } = await insertCalendar({ covers_to: CALENDAR.covers_from });
    await removeCalendar(id);
    expect(error).not.toBeNull();
  });

  it('rejects a calendar type outside the calendar_type enum', async () => {
    const { id, error } = await insertCalendar({ type: 'block_schedule' });
    await removeCalendar(id);
    expect(error).not.toBeNull();
  });

  // A district-wide calendar has a null school. Postgres treats nulls as distinct
  // by default, which would let the same year be entered twice — hence
  // `unique nulls not distinct`. 23505 is unique_violation.
  it('rejects the same district-wide year entered twice', async () => {
    await withSeededCalendar(async () => {
      const duplicate = await insertCalendar();
      await removeCalendar(duplicate.id);
      expect(duplicate.error?.code).toBe('23505');
    });
  });

  it('accepts the same label for a single school inside the district', async () => {
    await withSeededCalendar(async () => {
      const schoolCalendar = await insertCalendar({
        school: 'Fixture Elementary',
        type: 'year_round',
      });
      await removeCalendar(schoolCalendar.id);
      expect(schoolCalendar.error).toBeNull();
    });
  });
});
