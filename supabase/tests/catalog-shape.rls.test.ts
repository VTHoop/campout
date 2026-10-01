import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  campRow,
  insertId,
  LOCATION,
  optionRow,
  PROVENANCE,
  sessionRow,
  withCampAndLocation,
  withSeededSession,
} from './catalog-fixtures';
import { anonClient, serviceClient } from './helpers';

/**
 * The catalog's shape (CAM-27, PR 1): provider → camp → session, one to three
 * time options per session, standalone shared locations, and `details` checked
 * against its vocabulary. Each rejection asserts the Postgres error code, so a
 * test fails if the row was refused for some other reason:
 *
 *   23502 not_null_violation · 23505 unique_violation · 23514 check_violation ·
 *   22P02 invalid_text_representation (a value outside an enum)
 */

describe('providers', () => {
  it('lets an anonymous visitor read providers', async () => {
    const { error } = await anonClient().from('providers').select('id').limit(1);
    expect(error).toBeNull();
  });

  it('rejects a provider with neither a source URL nor a stored document', async () => {
    const { error } = await serviceClient()
      .from('providers')
      .insert({ name: 'Unevidenced', ...PROVENANCE, source_url: null });
    expect(error?.code).toBe('23514');
  });
});

describe('camps', () => {
  it('rejects a camp with no provider', async () => {
    await withCampAndLocation(async ({ providerId }, admin) => {
      const { error } = await admin
        .from('camps')
        .insert(campRow(providerId, { provider_id: null }));
      expect(error?.code).toBe('23502');
    });
  });

  it('accepts several subject categories on one camp', async () => {
    await withCampAndLocation(async ({ providerId }, admin) => {
      const { error } = await admin
        .from('camps')
        .insert(campRow(providerId, { categories: ['sports', 'outdoors'] }));
      expect(error).toBeNull();
    });
  });

  it.each([
    ['no categories', [], '23514'],
    // day_camp is a general program with varied activities, and stands alone.
    ['day_camp beside a subject', ['day_camp', 'sports'], '23514'],
    // The old enum's specialty and theater_music are dropped (decision 9).
    ['a dropped category', ['specialty'], '22P02'],
  ])('rejects a camp with %s', async (_case, categories, code) => {
    await withCampAndLocation(async ({ providerId }, admin) => {
      const { error } = await admin.from('camps').insert(campRow(providerId, { categories }));
      expect(error?.code).toBe(code);
    });
  });

  it('is removed with its provider', async () => {
    await withCampAndLocation(async ({ providerId, campId }, admin) => {
      await admin.from('providers').delete().eq('id', providerId);
      const after = await admin.from('camps').select('id').eq('id', campId);
      expect(after.data).toEqual([]);
    });
  });
});

describe('locations are standalone and shared', () => {
  it('hosts sessions from two different camps', async () => {
    await withSeededSession(async ({ providerId, locationId }, admin) => {
      const otherCamp = await insertId(
        admin,
        'camps',
        campRow(providerId, { name: 'Fixture Soccer', categories: ['sports'] }),
      );
      const { error } = await admin.from('sessions').insert(sessionRow(otherCamp, locationId));
      expect(error).toBeNull();
    });
  });

  // Duplicates are caught at review, not by a unique index (decision 17): real
  // venues can share an address.
  it('accepts a second location at the same address', async () => {
    await withCampAndLocation(async (_ids, admin) => {
      const { data, error } = await admin
        .from('locations')
        .insert({ ...LOCATION, label: 'Fixture Community Center, gym entrance' })
        .select('id')
        .single();
      expect(error).toBeNull();
      await admin
        .from('locations')
        .delete()
        .eq('id', data?.id as string);
    });
  });
});

/**
 * Insert extra locations for one duplicate-check test, run it, then remove them.
 * The fixture location sits at POINT(-77.4360 37.5407); 0.0002° of latitude is
 * about 22 m, and 0.0010° about 111 m.
 */
async function withExtraLocations(
  rows: Record<string, unknown>[],
  assert: (ids: { target: string; extras: string[] }, admin: SupabaseClient) => Promise<void>,
): Promise<void> {
  await withCampAndLocation(async ({ locationId }, admin) => {
    const extras: string[] = [];
    try {
      for (const row of rows) extras.push(await insertId(admin, 'locations', row));
      await assert({ target: locationId, extras }, admin);
    } finally {
      await admin.from('locations').delete().in('id', extras);
    }
  });
}

async function duplicatesOf(admin: SupabaseClient, target: string): Promise<string[]> {
  const { data, error } = await admin.rpc('find_location_duplicates', { target_id: target });
  expect(error).toBeNull();
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

describe('find_location_duplicates', () => {
  it('flags the same address written differently', async () => {
    const respelled = {
      ...LOCATION,
      label: 'Community Ctr',
      street: '100  TEST way.',
      point: 'SRID=4326;POINT(-77.4400 37.5500)',
    };
    await withExtraLocations([respelled], async ({ target, extras }, admin) => {
      expect(await duplicatesOf(admin, target)).toEqual(extras);
    });
  });

  it('flags a different address within about 30 m', async () => {
    const nextDoor = {
      ...LOCATION,
      label: 'Fixture Annex',
      street: '102 Test Way',
      point: 'SRID=4326;POINT(-77.4360 37.5409)',
    };
    await withExtraLocations([nextDoor], async ({ target, extras }, admin) => {
      expect(await duplicatesOf(admin, target)).toEqual(extras);
    });
  });

  it('does not flag a different address further away', async () => {
    const downTheRoad = {
      ...LOCATION,
      label: 'Fixture Library',
      street: '120 Test Way',
      point: 'SRID=4326;POINT(-77.4360 37.5417)',
    };
    await withExtraLocations([downTheRoad], async ({ target }, admin) => {
      expect(await duplicatesOf(admin, target)).toEqual([]);
    });
  });
});

describe('sessions', () => {
  it('accepts a closed date inside the session', async () => {
    await withCampAndLocation(async ({ campId, locationId }, admin) => {
      const { error } = await admin.from('sessions').insert(
        sessionRow(campId, locationId, {
          start_date: '2027-06-14',
          end_date: '2027-06-25',
          closed_dates: ['2027-06-18'],
        }),
      );
      expect(error).toBeNull();
    });
  });

  it('rejects a closed date outside the session', async () => {
    await withCampAndLocation(async ({ campId, locationId }, admin) => {
      const { error } = await admin
        .from('sessions')
        .insert(sessionRow(campId, locationId, { closed_dates: ['2027-07-19'] }));
      expect(error?.code).toBe('23514');
    });
  });

  // `start_date <= all ('{NULL}')` is NULL, which a check constraint lets
  // through, so a blank closed date has to be refused on its own.
  it('rejects a blank closed date', async () => {
    await withCampAndLocation(async ({ campId, locationId }, admin) => {
      const { error } = await admin
        .from('sessions')
        .insert(sessionRow(campId, locationId, { closed_dates: ['2027-07-14', null] }));
      expect(error?.code).toBe('23514');
    });
  });

  it('defaults to no closed dates', async () => {
    await withSeededSession(async ({ sessionId }, admin) => {
      const { data } = await admin
        .from('sessions')
        .select('closed_dates')
        .eq('id', sessionId)
        .single();
      expect(data?.closed_dates).toEqual([]);
    });
  });

  it('keeps an optional theme', async () => {
    await withCampAndLocation(async ({ campId, locationId }, admin) => {
      const { error } = await admin
        .from('sessions')
        .insert(sessionRow(campId, locationId, { theme: 'Space Week' }));
      expect(error).toBeNull();
    });
  });
});

describe('session options', () => {
  it('accepts a full day, a morning and an afternoon on one session', async () => {
    await withSeededSession(async ({ sessionId }, admin) => {
      const { error } = await admin
        .from('session_options')
        .insert([
          optionRow(sessionId, { kind: 'full_day' }),
          optionRow(sessionId, { kind: 'morning', price_cents: 22500 }),
          optionRow(sessionId, { kind: 'afternoon', price_cents: 22500 }),
        ]);
      expect(error).toBeNull();
    });
  });

  it('rejects a second option of the same kind on one session', async () => {
    await withSeededSession(async ({ sessionId }, admin) => {
      await insertId(admin, 'session_options', optionRow(sessionId, { kind: 'morning' }));
      const { error } = await admin
        .from('session_options')
        .insert(optionRow(sessionId, { kind: 'morning' }));
      expect(error?.code).toBe('23505');
    });
  });

  // Unknown hours are left blank and shown as "Hours not stated", never filled.
  it('accepts an option whose hours are not stated', async () => {
    await withSeededSession(async ({ sessionId }, admin) => {
      const { error } = await admin.from('session_options').insert(optionRow(sessionId));
      expect(error).toBeNull();
    });
  });

  it('keeps drop-off and pickup times around the hours', async () => {
    await withSeededSession(async ({ sessionId }, admin) => {
      const { error } = await admin.from('session_options').insert(
        optionRow(sessionId, {
          daily_start: '09:00',
          daily_end: '15:00',
          earliest_dropoff: '08:00',
          latest_pickup: '17:30',
        }),
      );
      expect(error).toBeNull();
    });
  });

  it.each([
    ['a kind outside the three', { kind: 'evening' }, '22P02'],
    ['a negative price', { price_cents: -100 }, '23514'],
    ['an end before the start', { daily_start: '15:00', daily_end: '09:00' }, '23514'],
    ['a start with no end', { daily_start: '09:00' }, '23514'],
    [
      'a drop-off after the start',
      { daily_start: '09:00', daily_end: '15:00', earliest_dropoff: '09:30' },
      '23514',
    ],
    [
      'a pickup before the end',
      { daily_start: '09:00', daily_end: '15:00', latest_pickup: '14:00' },
      '23514',
    ],
  ])('rejects %s', async (_case, overrides, code) => {
    await withSeededSession(async ({ sessionId }, admin) => {
      const { error } = await admin.from('session_options').insert(optionRow(sessionId, overrides));
      expect(error?.code).toBe(code);
    });
  });

  it('is removed with its session', async () => {
    await withSeededSession(async ({ sessionId }, admin) => {
      const optionId = await insertId(admin, 'session_options', optionRow(sessionId));
      await admin.from('sessions').delete().eq('id', sessionId);
      const after = await admin.from('session_options').select('id').eq('id', optionId);
      expect(after.data).toEqual([]);
    });
  });

  it('lets an anonymous visitor read options', async () => {
    const { error } = await anonClient().from('session_options').select('id').limit(1);
    expect(error).toBeNull();
  });
});

const CAMP_DETAILS = {
  activities: ['swimming', 'field games'],
  discounts: [
    { kind: 'sibling', percent_off: 10 },
    { kind: 'early_registration', amount_cents: 2500, deadline: '2027-03-31' },
  ],
  membership_required: { name: 'Fixture League membership', price_cents: 2000, period: 'year' },
  skill_required: 'Can swim one length unassisted',
  eligibility_wording: 'completed 4th grade',
  lunch: { provision: 'sold_separately', price_cents: 700 },
  policies: { cancellation: 'Full refund until May 1', switching_weeks: 'Free until June 1' },
  financial_aid: true,
  registration_opens: '2027-01-15',
};

const SESSION_DETAILS = {
  field_trips: [{ destination: 'Science museum', min_grade: 3, max_grade: 5 }],
  other_days: [{ date: '2027-07-15', location: 'Fixture Pool (200 Test Way)' }],
};

const OPTION_DETAILS = {
  daily_rate: { price_cents: 9000 },
  care_fees: { drop_off: { price_cents: 1000, per: 'day' } },
};

describe('details', () => {
  it('accepts every camp key in the vocabulary', async () => {
    await withCampAndLocation(async ({ campId }, admin) => {
      const { error } = await admin
        .from('camps')
        .update({ details: CAMP_DETAILS })
        .eq('id', campId);
      expect(error).toBeNull();
    });
  });

  it('accepts every session key in the vocabulary', async () => {
    await withSeededSession(async ({ sessionId }, admin) => {
      const { error } = await admin
        .from('sessions')
        .update({ details: SESSION_DETAILS })
        .eq('id', sessionId);
      expect(error).toBeNull();
    });
  });

  it('accepts every option key in the vocabulary', async () => {
    await withSeededSession(async ({ sessionId }, admin) => {
      const { error } = await admin
        .from('session_options')
        .insert(optionRow(sessionId, { details: OPTION_DETAILS }));
      expect(error).toBeNull();
    });
  });

  it('defaults to an empty object', async () => {
    await withCampAndLocation(async ({ campId }, admin) => {
      const { data } = await admin.from('camps').select('details').eq('id', campId).single();
      expect(data?.details).toEqual({});
    });
  });

  it.each([
    ['camps', { staff_ratio: '1:8' }],
    ['camps', { financial_aid: 'yes' }],
    ['camps', { discounts: [{ kind: 'sibling', percent_off: 10, amount_cents: 500 }] }],
    ['camps', { lunch: { provision: 'catered' } }],
    ['sessions', { field_trips: [{ min_grade: 3 }] }],
    ['sessions', { description: 'A week of fun!' }],
  ])('rejects %s details of %j', async (table, details) => {
    await withSeededSession(async ({ campId, sessionId }, admin) => {
      const id = table === 'camps' ? campId : sessionId;
      const { error } = await admin.from(table).update({ details }).eq('id', id);
      expect(error?.code).toBe('23514');
    });
  });

  it.each([
    [{ daily_rate: 9000 }],
    [{ care_fees: { drop_off: { price_cents: 1000, per: 'hour' } } }],
    [{ price_unit: 'week' }],
  ])('rejects option details of %j', async (details) => {
    await withSeededSession(async ({ sessionId }, admin) => {
      const { error } = await admin
        .from('session_options')
        .insert(optionRow(sessionId, { details }));
      expect(error?.code).toBe('23514');
    });
  });
});

interface SearchRow {
  session_id: string;
  from_price_cents: number | null;
}

async function search(args: Record<string, unknown>): Promise<SearchRow[]> {
  const { data, error } = await anonClient().rpc('search_sessions', {
    window_start: '2099-06-01',
    window_end: '2099-08-31',
    ...args,
  });
  expect(error).toBeNull();
  return data as SearchRow[];
}

/**
 * Two camps under one provider, in the year 2099 so the seed never collides:
 * a day camp's week with a full day and a cheaper morning, and a sports week
 * with no stated price.
 */
async function withSearchableSessions(
  assert: (ids: { dayCampWeek: string; sportsWeek: string }) => Promise<void>,
): Promise<void> {
  await withCampAndLocation(async ({ providerId, campId, locationId }, admin) => {
    const sportsCamp = await insertId(
      admin,
      'camps',
      campRow(providerId, { name: 'Fixture Soccer', categories: ['sports'] }),
    );
    const week = { start_date: '2099-07-06', end_date: '2099-07-10' };
    const dayCampWeek = await insertId(admin, 'sessions', sessionRow(campId, locationId, week));
    const sportsWeek = await insertId(admin, 'sessions', sessionRow(sportsCamp, locationId, week));
    await admin
      .from('session_options')
      .insert([
        optionRow(dayCampWeek, { kind: 'full_day', price_cents: 40000 }),
        optionRow(dayCampWeek, { kind: 'morning', price_cents: 22500 }),
        optionRow(sportsWeek, { kind: 'full_day', price_cents: null }),
      ]);
    await assert({ dayCampWeek, sportsWeek });
  });
}

function ids(rows: SearchRow[]): string[] {
  return rows.map((row) => row.session_id).sort();
}

describe('search_sessions', () => {
  it('returns one row per session overlapping the window, with its lowest option price', async () => {
    await withSearchableSessions(async ({ dayCampWeek, sportsWeek }) => {
      const rows = await search({});
      expect(ids(rows)).toEqual([dayCampWeek, sportsWeek].sort());
      expect(rows.find((row) => row.session_id === dayCampWeek)?.from_price_cents).toBe(22500);
      expect(rows.find((row) => row.session_id === sportsWeek)?.from_price_cents).toBeNull();
    });
  });

  it('counts a session that only touches the window’s last day', async () => {
    await withSearchableSessions(async ({ dayCampWeek, sportsWeek }) => {
      const rows = await search({ window_start: '2099-06-01', window_end: '2099-07-06' });
      expect(ids(rows)).toEqual([dayCampWeek, sportsWeek].sort());
    });
  });

  it('leaves out a session outside the window', async () => {
    await withSearchableSessions(async () => {
      expect(await search({ window_start: '2099-07-13', window_end: '2099-07-17' })).toEqual([]);
    });
  });

  it('matches a session whose camp has any wanted category', async () => {
    await withSearchableSessions(async ({ sportsWeek }) => {
      const rows = await search({ wanted_categories: ['sports', 'arts'] });
      expect(ids(rows)).toEqual([sportsWeek]);
    });
  });

  // The price filter matches any option: the morning fits under $250 even though
  // the full day does not. A session with no stated price can't be said to fit.
  it('matches a session with any option at or under the price', async () => {
    await withSearchableSessions(async ({ dayCampWeek }) => {
      const rows = await search({ max_price_cents: 25000 });
      expect(ids(rows)).toEqual([dayCampWeek]);
    });
  });
});
