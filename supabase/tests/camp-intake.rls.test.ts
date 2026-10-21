import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  campPlan,
  locationPlan,
  planOf,
  providerPlan,
  sessionPlan,
  wholePlan,
} from '../../src/lib/catalog/intake/intake-fixtures';
import { addressKey, IntakeKind, type IntakePlan } from '../../src/lib/catalog/intake/plan';
import {
  IntakeRefusedError,
  previewIntake,
  UnansweredMatchError,
  writeIntake,
} from '../../src/lib/catalog/intake/write';
import { LunchProvision } from '../../src/lib/db/details';
import { approve, createReviewer, insertId, planIntoNewHousehold } from './catalog-fixtures';
import {
  anonClient,
  createTestUser,
  deleteTestUsers,
  serviceClient,
  type TestUser,
} from './helpers';

/**
 * The intake writer (CAM-47) against a real local Postgres, with the secret
 * key the local script holds. The guard triggers and constraints are the
 * point, so a fake client would test nothing. Every row a test writes carries
 * that test's marker in its name, and is removed after it.
 */

let admin: SupabaseClient;
let parent: TestUser;
let reviewer: TestUser;
let marker: string;
const markers: string[] = [];

const FLYER_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function options() {
  return {
    readDocument: vi.fn(() => Promise.resolve(FLYER_BYTES)),
    uploadDocument: vi.fn(() => Promise.resolve()),
  };
}

async function rowsLike(table: 'providers' | 'camps', column: string, like: string) {
  const { data, error } = await admin.from(table).select('*').ilike(column, `%${like}%`);
  if (error) throw new Error(`Could not read ${table}: ${error.message}`);
  return data as Record<string, unknown>[];
}

async function rowById(table: string, id: string): Promise<Record<string, unknown>> {
  const { data, error } = await admin.from(table).select('*').eq('id', id).single();
  if (error) throw new Error(`Could not read ${table} ${id}: ${error.message}`);
  return data as Record<string, unknown>;
}

function idOf(result: { drafted: readonly { kind: IntakeKind; id: string }[] }, kind: IntakeKind) {
  const drafted = result.drafted.find((row) => row.kind === kind);
  if (drafted === undefined) throw new Error(`nothing of kind ${kind} was drafted`);
  return drafted.id;
}

/** Back to draft, out of every plan, then gone: verified rows and planned sessions can't be deleted. */
async function removeMarked(like: string): Promise<void> {
  const providers = (await rowsLike('providers', 'name', like)).map((row) => row.id as string);
  const { data: camps } = await admin.from('camps').select('id').in('provider_id', providers);
  const campIds = (camps ?? []).map((camp: { id: string }) => camp.id);
  const { data: sessions } = await admin.from('sessions').select('id').in('camp_id', campIds);
  const sessionIds = (sessions ?? []).map((session: { id: string }) => session.id);
  await admin.from('plan_entries').delete().in('session_id', sessionIds);
  await admin.from('sessions').update({ status: 'draft' }).in('id', sessionIds);
  await admin.from('camps').update({ status: 'draft' }).in('id', campIds);
  await admin.from('providers').update({ status: 'draft' }).in('id', providers);
  await admin.from('providers').delete().in('id', providers);
  await admin.from('locations').update({ status: 'draft' }).ilike('label', `%${like}%`);
  await admin.from('locations').delete().ilike('label', `%${like}%`);
}

/** Write the whole plan and approve its chain, as a reviewer would from the card. */
async function writeAndApprove(plan: IntakePlan) {
  const result = await writeIntake(admin, plan, options());
  await approve(reviewer, 'provider', idOf(result, IntakeKind.Provider));
  await approve(reviewer, 'location', idOf(result, IntakeKind.Location));
  await approve(reviewer, 'camp', idOf(result, IntakeKind.Camp));
  await approve(reviewer, 'session', idOf(result, IntakeKind.Session));
  return result;
}

beforeAll(async () => {
  admin = serviceClient();
  parent = await createTestUser('intake-parent');
  reviewer = await createReviewer('intake-reviewer');
});

afterAll(async () => {
  await deleteTestUsers([parent, reviewer]);
});

beforeEach(() => {
  marker = `Mk${crypto.randomUUID().slice(0, 8)}`;
  markers.push(marker);
});

afterEach(async () => {
  for (const each of markers.splice(0)) await removeMarked(each);
});

describe('drafting', () => {
  it('writes every new row as a draft, and a signed-out visitor and a parent read none of it', async () => {
    const result = await writeIntake(admin, wholePlan(marker), options());

    for (const [table, kind] of [
      ['providers', IntakeKind.Provider],
      ['locations', IntakeKind.Location],
      ['camps', IntakeKind.Camp],
      ['sessions', IntakeKind.Session],
    ] as const) {
      const id = idOf(result, kind);
      expect((await rowById(table, id)).status).toBe('draft');
      for (const visitor of [anonClient(), parent.client]) {
        const { data } = await visitor.from(table).select('id').eq('id', id);
        expect(data).toEqual([]);
      }
    }
  });

  it('writes provider, location, camp, sessions and options, each under its parent', async () => {
    const plan = planOf({
      ...wholePlan(marker),
      sessions: [
        sessionPlan({
          options: [
            { kind: 'morning', price_cents: 20000 },
            { kind: 'afternoon', price_cents: 18000 },
          ],
        }),
        sessionPlan({ ref: 'second', facts: { start_date: '2027-07-19', end_date: '2027-07-23' } }),
      ],
    });
    const result = await writeIntake(admin, plan, options());

    expect(result.drafted.map((row) => row.kind)).toEqual([
      IntakeKind.Provider,
      IntakeKind.Location,
      IntakeKind.Camp,
      IntakeKind.Session,
      IntakeKind.Option,
      IntakeKind.Option,
      IntakeKind.Session,
      IntakeKind.Option,
    ]);
    const camp = await rowById('camps', idOf(result, IntakeKind.Camp));
    expect(camp.provider_id).toBe(idOf(result, IntakeKind.Provider));
    const { data: sessions } = await admin
      .from('sessions')
      .select('location_id, start_date, session_options(kind)')
      .eq('camp_id', camp.id as string)
      .order('start_date');
    expect(sessions).toEqual([
      {
        location_id: idOf(result, IntakeKind.Location),
        start_date: '2027-07-12',
        session_options: expect.arrayContaining([{ kind: 'morning' }, { kind: 'afternoon' }]),
      },
      {
        location_id: idOf(result, IntakeKind.Location),
        start_date: '2027-07-19',
        session_options: [{ kind: 'full_day' }],
      },
    ]);
  });

  it('writes the details facts the source states, on camp, session and option', async () => {
    const plan = planOf({
      ...wholePlan(marker),
      camps: [
        campPlan(marker, {
          facts: {
            name: `Intake Swim Camp ${marker}`,
            categories: ['sports'],
            registration_url: 'https://example.test/intake/register',
            details: { activities: ['swimming'], lunch: { provision: LunchProvision.BringOwn } },
          },
        }),
      ],
      sessions: [
        sessionPlan({
          facts: {
            start_date: '2027-07-12',
            end_date: '2027-07-16',
            details: { field_trips: [{ destination: 'Science Museum', min_grade: 3 }] },
          },
          options: [
            {
              kind: 'full_day',
              price_cents: 40000,
              details: { daily_rate: { price_cents: 9000 } },
            },
          ],
        }),
      ],
    });
    const result = await writeIntake(admin, plan, options());

    expect((await rowById('camps', idOf(result, IntakeKind.Camp))).details).toEqual({
      activities: ['swimming'],
      lunch: { provision: 'bring_own' },
    });
    expect((await rowById('sessions', idOf(result, IntakeKind.Session))).details).toEqual({
      field_trips: [{ destination: 'Science Museum', min_grade: 3 }],
    });
    expect((await rowById('session_options', idOf(result, IntakeKind.Option))).details).toEqual({
      daily_rate: { price_cents: 9000 },
    });
  });

  it('uploads a document source to camp-sources before any row that cites it', async () => {
    const path = `intake-${marker}-flyer.jpg`;
    const plan = planOf({
      ...wholePlan(marker),
      documents: [{ path, file: 'scratch/flyer.jpg' }],
      providers: [providerPlan(marker, { source: { documentPath: path } })],
    });
    const io = options();
    io.uploadDocument.mockImplementation(async () => {
      expect(await rowsLike('providers', 'name', marker)).toEqual([]);
    });

    const result = await writeIntake(admin, plan, io);

    expect(io.readDocument).toHaveBeenCalledWith('scratch/flyer.jpg');
    expect(io.uploadDocument).toHaveBeenCalledWith(path, FLYER_BYTES);
    expect(
      (await rowById('providers', idOf(result, IntakeKind.Provider))).source_document_path,
    ).toBe(path);
  });
});

describe('the checkpoint', () => {
  it('a preview writes nothing, and proposes the held records a new one may duplicate', async () => {
    const heldId = await insertId(admin, 'providers', {
      name: `Intake League ${marker}`,
      source_url: 'https://example.test/intake',
    });

    const preview = await previewIntake(admin, wholePlan(marker));

    expect(preview.matches).toEqual([
      expect.objectContaining({
        ref: 'provider',
        candidates: [{ id: heldId, name: `Intake League ${marker}`, status: 'draft' }],
      }),
    ]);
    expect(await rowsLike('providers', 'name', marker)).toHaveLength(1);
    expect(await rowsLike('camps', 'name', marker)).toEqual([]);
  });

  it('refuses to write while a proposed match is unanswered, and writes once it is ruled out', async () => {
    const heldId = await insertId(admin, 'providers', {
      name: `Intake League ${marker}`,
      source_url: 'https://example.test/intake',
    });

    await expect(writeIntake(admin, wholePlan(marker), options())).rejects.toBeInstanceOf(
      UnansweredMatchError,
    );
    expect(await rowsLike('providers', 'name', marker)).toHaveLength(1);

    const ruledOut = planOf({
      ...wholePlan(marker),
      providers: [providerPlan(marker, { distinctFrom: [heldId] })],
    });
    await writeIntake(admin, ruledOut, options());
    expect(await rowsLike('providers', 'name', marker)).toHaveLength(2);
  });

  it('puts new camps and sessions under a confirmed existing provider and location, duplicating neither', async () => {
    const providerId = await insertId(admin, 'providers', {
      name: `Intake League ${marker}`,
      source_url: 'https://example.test/intake',
    });
    const location = locationPlan(marker);
    const locationId = await insertId(admin, 'locations', {
      ...location.facts,
      point: 'SRID=4326;POINT(-77.436 37.5407)',
      source_url: 'https://example.test/intake',
    });
    const plan = planOf({
      providers: [{ ref: 'provider', existing: providerId }],
      locations: [{ ref: 'location', existing: locationId }],
      camps: [campPlan(marker)],
      sessions: [sessionPlan()],
    });

    const result = await writeIntake(admin, plan, options());

    expect(await rowsLike('providers', 'name', marker)).toHaveLength(1);
    expect(result.drafted.map((row) => row.kind)).toEqual([
      IntakeKind.Camp,
      IntakeKind.Session,
      IntakeKind.Option,
    ]);
    expect((await rowById('camps', idOf(result, IntakeKind.Camp))).provider_id).toBe(providerId);
    expect((await rowById('sessions', idOf(result, IntakeKind.Session))).location_id).toBe(
      locationId,
    );
  });

  it('derives the same address key Postgres does, so a location match finds what the review would', async () => {
    for (const [street, postal] of [
      ['12  Main St., Suite #4', '23220-1234'],
      [`  #9 ${marker} Rd.`, '23112.'],
    ] as const) {
      const id = await insertId(admin, 'locations', {
        label: `Intake Key ${marker}`,
        street,
        city: 'Richmond',
        postal_code: postal,
        point: 'SRID=4326;POINT(-77.436 37.5407)',
        source_url: 'https://example.test/intake',
      });
      expect((await rowById('locations', id)).address_key).toBe(addressKey(street, postal));
    }
  });

  it('a new location without coordinates is refused by the database, and nothing after it is written', async () => {
    const plan = planOf({
      ...wholePlan(marker),
      locations: [locationPlan(marker, { coordinates: null })],
    });

    const error = await writeIntake(admin, plan, options()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(IntakeRefusedError);
    const refused = error as IntakeRefusedError;
    expect(refused.message).toMatch(/point/);
    expect(refused.result.refusal).toBe(refused.message);
    expect(refused.result.drafted.map((row) => row.kind)).toEqual([IntakeKind.Provider]);
    expect(await rowsLike('camps', 'name', marker)).toEqual([]);
  });
});

describe('the gate', () => {
  it('stops at the first row the database refuses, in its words; what came before stays a draft', async () => {
    const plan = planOf({
      ...wholePlan(marker),
      sessions: [
        sessionPlan({ facts: { start_date: '2027-07-16', end_date: '2027-07-12' } }),
        sessionPlan({ ref: 'second', facts: { start_date: '2027-07-19', end_date: '2027-07-23' } }),
      ],
    });

    const error = await writeIntake(admin, plan, options()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(IntakeRefusedError);
    const refused = error as IntakeRefusedError;
    expect(refused.message).toMatch(/check constraint/);
    expect(refused.result.drafted.map((row) => row.kind)).toEqual([
      IntakeKind.Provider,
      IntakeKind.Location,
      IntakeKind.Camp,
    ]);
    const camp = await rowById('camps', idOf(refused.result, IntakeKind.Camp));
    expect(camp.status).toBe('draft');
    const { data: sessions } = await admin
      .from('sessions')
      .select('id')
      .eq('camp_id', camp.id as string);
    expect(sessions).toEqual([]);
  });

  it('refuses a details key outside the vocabulary', async () => {
    const plan = planOf({
      ...wholePlan(marker),
      camps: [
        campPlan(marker, {
          facts: {
            name: `Intake Day Camp ${marker}`,
            categories: ['day_camp'],
            registration_url: 'https://example.test/intake/register',
            details: { mascot: 'Owl' } as never,
          },
        }),
      ],
    });

    await expect(writeIntake(admin, plan, options())).rejects.toBeInstanceOf(IntakeRefusedError);
    expect(await rowsLike('camps', 'name', marker)).toEqual([]);
  });
});

describe('updates', () => {
  it('applies only the differences the owner approved', async () => {
    const result = await writeIntake(admin, wholePlan(marker), options());
    const campId = idOf(result, IntakeKind.Camp);

    await writeIntake(
      admin,
      planOf({
        updates: [
          {
            kind: IntakeKind.Camp,
            id: campId,
            sourceUrl: 'https://example.test/intake/brochure.pdf',
            proposed: { name: `Intake Junior Camp ${marker}`, summary: 'Ages 6 to 9.' },
            approved: ['name'],
          },
        ],
      }),
      options(),
    );

    const camp = await rowById('camps', campId);
    expect(camp.name).toBe(`Intake Junior Camp ${marker}`);
    expect(camp.summary).toBeNull();
  });

  it('corrects a draft in place: the same row, still a draft, and nothing put back', async () => {
    const first = await writeIntake(admin, wholePlan(marker), options());
    const campId = idOf(first, IntakeKind.Camp);

    const result = await writeIntake(
      admin,
      planOf({
        updates: [
          {
            kind: IntakeKind.Camp,
            id: campId,
            sourceUrl: 'https://example.test/intake/brochure.pdf',
            proposed: { name: `Intake Junior Camp ${marker}` },
            approved: ['name'],
          },
        ],
      }),
      options(),
    );

    expect(result).toEqual({
      drafted: [],
      updated: [{ kind: IntakeKind.Camp, id: campId, fields: ['name'] }],
    });
    expect(await rowsLike('camps', 'name', marker)).toEqual([
      expect.objectContaining({ id: campId, status: 'draft' }),
    ]);
  });

  it('sets a verified record back to draft, then corrects it, for the owner to re-approve', async () => {
    const written = await writeAndApprove(wholePlan(marker));
    const campId = idOf(written, IntakeKind.Camp);

    const result = await writeIntake(
      admin,
      planOf({
        updates: [
          {
            kind: IntakeKind.Camp,
            id: campId,
            sourceUrl: 'https://example.test/intake/brochure.pdf',
            proposed: { name: `Intake Junior Camp ${marker}` },
            approved: ['name'],
          },
        ],
      }),
      options(),
    );

    expect(result.updated).toEqual([
      {
        kind: IntakeKind.Camp,
        id: campId,
        fields: ['name'],
        setBackToDraft: { kind: IntakeKind.Camp, id: campId },
      },
    ]);
    const camp = await rowById('camps', campId);
    expect(camp).toMatchObject({ status: 'draft', name: `Intake Junior Camp ${marker}` });
  });

  it("corrects a verified session's option by putting the session back to draft first", async () => {
    const written = await writeAndApprove(wholePlan(marker));
    const sessionId = idOf(written, IntakeKind.Session);
    const optionId = idOf(written, IntakeKind.Option);

    const result = await writeIntake(
      admin,
      planOf({
        updates: [
          {
            kind: IntakeKind.Option,
            id: optionId,
            sourceUrl: 'https://example.test/intake/brochure.pdf',
            proposed: { price_cents: 34500 },
            approved: ['price_cents'],
          },
        ],
      }),
      options(),
    );

    expect(result.updated).toEqual([
      {
        kind: IntakeKind.Option,
        id: optionId,
        fields: ['price_cents'],
        setBackToDraft: { kind: IntakeKind.Session, id: sessionId },
      },
    ]);
    expect((await rowById('sessions', sessionId)).status).toBe('draft');
    expect((await rowById('session_options', optionId)).price_cents).toBe(34500);
  });

  it("warns, with a count, before unpublishing a session in a family's plan, and changes nothing", async () => {
    const written = await writeAndApprove(wholePlan(marker));
    const campId = idOf(written, IntakeKind.Camp);
    const sessionId = idOf(written, IntakeKind.Session);
    const householdId = await planIntoNewHousehold(
      parent,
      `Intake Family ${marker}`,
      sessionId,
      idOf(written, IntakeKind.Option),
    );

    const preview = await previewIntake(
      admin,
      planOf({
        updates: [
          {
            kind: IntakeKind.Camp,
            id: campId,
            sourceUrl: 'https://example.test/intake/brochure.pdf',
            proposed: { name: `Intake Junior Camp ${marker}` },
            approved: ['name'],
          },
        ],
      }),
    );

    expect(preview.unpublishes).toEqual([{ kind: IntakeKind.Camp, id: campId, plannedEntries: 1 }]);
    expect(preview.differences).toEqual([
      expect.objectContaining({
        differences: [
          {
            field: 'name',
            ours: `Intake Day Camp ${marker}`,
            source: `Intake Junior Camp ${marker}`,
            sourceUrl: 'https://example.test/intake/brochure.pdf',
          },
        ],
      }),
    ]);
    expect((await rowById('camps', campId)).status).toBe('verified');
    await admin.from('households').delete().eq('id', householdId);
  });
});
