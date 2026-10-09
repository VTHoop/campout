import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mapCatalogToDrafts } from '../../src/lib/catalog/import/map-catalog';
import { CatalogNotEmptyError, importDrafts } from '../../src/lib/catalog/import/write-drafts';
import { Category } from '../../src/lib/catalog/types';
import { isLiveProject, runSql, serviceClient } from './helpers';

/**
 * The one-time import's writer (CAM-28), against a real local Postgres: the
 * review gate's guard triggers are the point, so a fake client would test
 * nothing. The import refuses a catalog that already holds rows, and the local
 * seed is rows, so each run empties the catalog first and puts the seed back
 * after. Local only: emptying a live project's catalog is never a test's job.
 */

const FLYER_PATH = 'fixture-flyer-2027.jpg';
const FLYER_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

/** Invented: one provider with a page as its source, one whose only evidence is a flyer. */
const drafts = mapCatalogToDrafts({
  providers: [
    {
      id: 'p-page',
      name: 'Fixture Rec League',
      source: { url: 'https://example.test/camps-2027' },
    },
    { id: 'p-flyer', name: 'Fixture Swim Club', source: { documentPath: FLYER_PATH } },
  ],
  locations: [
    {
      id: 'l-center',
      name: 'Fixture Community Center',
      address: '100 Test Way',
      city: 'Richmond',
      state: 'VA',
      postalCode: '23220',
      lat: 37.5407,
      long: -77.436,
    },
    {
      id: 'l-pool',
      name: 'Fixture Pool',
      address: '200 Test Way',
      city: 'Richmond',
      state: 'VA',
      postalCode: '23221',
      lat: 37.55,
      long: -77.45,
    },
  ],
  camps: [
    {
      id: 'c-day',
      name: 'Fixture Day Camp',
      description: 'A short summary we wrote.',
      providerId: 'p-page',
      categories: [Category.Sports],
      registrationInfo: { url: 'https://example.test/register' },
    },
    {
      id: 'c-swim',
      name: 'Fixture Swim Camp',
      description: 'Another summary we wrote.',
      providerId: 'p-flyer',
      categories: [Category.Sports, Category.Outdoors],
      registrationInfo: { phone: '804-555-0100' },
    },
  ],
  sessions: [
    {
      id: 's-1',
      campId: 'c-day',
      locationId: 'l-center',
      startDate: '2027-07-12',
      endDate: '2027-07-16',
      startTime: '09:00',
      endTime: '17:00',
      priceCents: 40_000,
    },
    {
      id: 's-2',
      campId: 'c-day',
      locationId: 'l-center',
      startDate: '2027-07-19',
      endDate: '2027-07-23',
    },
    {
      id: 's-3',
      campId: 'c-swim',
      locationId: 'l-pool',
      startDate: '2027-07-12',
      endDate: '2027-07-16',
      startTime: '09:00',
      endTime: '12:00',
      priceCents: 20_000,
    },
  ],
});

const options = () => ({ readDocument: vi.fn(() => Promise.resolve(FLYER_BYTES)) });

async function rowCount(table: string): Promise<number> {
  const { count, error } = await serviceClient()
    .from(table)
    .select('id', { count: 'exact', head: true });
  if (error) throw new Error(`Could not count ${table}: ${error.message}`);
  return count ?? 0;
}

function emptyCatalog(): void {
  runSql('truncate providers, locations, school_calendars cascade');
}

function restoreSeed(): void {
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_campout',
      'psql',
      '-U',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: readFileSync('supabase/seed.sql'), stdio: ['pipe', 'ignore', 'pipe'] },
  );
}

describe.skipIf(isLiveProject())('importDrafts', () => {
  beforeAll(() => {
    emptyCatalog();
  });

  afterAll(async () => {
    await serviceClient().storage.from('camp-sources').remove([FLYER_PATH]);
    emptyCatalog();
    restoreSeed();
  });

  it('writes every draft, linked to its parents, and every row is a draft', async () => {
    const summary = await importDrafts(serviceClient(), drafts, options());

    expect(summary).toEqual({
      providers: 2,
      locations: 2,
      camps: 2,
      sessions: 3,
      options: 3,
      documents: 1,
    });
    expect(await rowCount('providers')).toBe(2);
    expect(await rowCount('locations')).toBe(2);
    expect(await rowCount('camps')).toBe(2);
    expect(await rowCount('sessions')).toBe(3);
    expect(await rowCount('session_options')).toBe(3);

    const { data: sessions } = await serviceClient()
      .from('sessions')
      .select('status, start_date, camps(name, providers(name)), locations(label)')
      .eq('start_date', '2027-07-12')
      .order('start_date');
    expect(sessions).toHaveLength(2);
    expect(sessions?.map((s) => s.status)).toEqual(['draft', 'draft']);
    expect(JSON.stringify(sessions)).toContain('Fixture Swim Club');
    expect(JSON.stringify(sessions)).toContain('Fixture Pool');
  });

  it('keeps a document source as a path and a page source as a URL', async () => {
    const { data } = await serviceClient()
      .from('providers')
      .select('name, source_url, source_document_path')
      .order('name');
    expect(data).toEqual([
      {
        name: 'Fixture Rec League',
        source_url: 'https://example.test/camps-2027',
        source_document_path: null,
      },
      { name: 'Fixture Swim Club', source_url: null, source_document_path: FLYER_PATH },
    ]);
  });

  it('stores the source document in the camp-sources bucket', async () => {
    const { data, error } = await serviceClient().storage.from('camp-sources').download(FLYER_PATH);
    expect(error).toBeNull();
    expect(new Uint8Array((await data?.arrayBuffer()) ?? new ArrayBuffer(0))).toEqual(FLYER_BYTES);
  });

  it('refuses a second run, writing and uploading nothing', async () => {
    const second = options();
    await expect(importDrafts(serviceClient(), drafts, second)).rejects.toBeInstanceOf(
      CatalogNotEmptyError,
    );
    expect(second.readDocument).not.toHaveBeenCalled();
    expect(await rowCount('providers')).toBe(2);
    expect(await rowCount('sessions')).toBe(3);
  });
});
