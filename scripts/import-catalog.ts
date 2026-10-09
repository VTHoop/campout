// One-time import of the TypeScript mock catalog into Supabase, as drafts (CAM-28).
// Run from workspace root:
//   pnpm catalog:import          report what is ready and what is missing; writes nothing
//   pnpm catalog:import --yes    write the drafts to the project .env.local points at
//
// Local only, with the secret key (ADR-0017 §3): never in app code, never on Vercel.
// The key can write drafts and nothing more, because the guard trigger refuses
// any row that is not one. Refuses when the catalog already holds rows.
//
// Deleted with the mock once it has run.
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { findImportGaps, mapCatalogToDrafts } from '../src/lib/catalog/import/map-catalog';
import { importDrafts } from '../src/lib/catalog/import/write-drafts';
import {
  mockCamps,
  mockLocations,
  mockProviders,
  mockSessions,
} from '../src/lib/catalog/mock-data';

const DOCUMENT_BUCKET = 'camp-sources';

/** Source documents by the path they are stored under, and where they sit in this repo. */
const LOCAL_DOCUMENTS: ReadonlyMap<string, string> = new Map([
  [
    'vcu-baseball-2026-summer-youth-camps.jpg',
    'docs/data/613315829_1388635603291900_6387529962224608340_n.jpg',
  ],
]);

const CONTENT_TYPES: ReadonlyMap<string, string> = new Map([
  ['pdf', 'application/pdf'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
]);

const catalog = {
  providers: mockProviders,
  locations: mockLocations,
  camps: mockCamps,
  sessions: mockSessions,
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set. Put it in .env.local (see .env.example).`);
    process.exit(2);
  }
  return value;
}

const gaps = findImportGaps(catalog);
if (gaps.length > 0) {
  console.error(`Not ready to import. ${gaps.length} gap(s):\n  - ${gaps.join('\n  - ')}`);
  process.exit(1);
}

const drafts = mapCatalogToDrafts(catalog);
console.log(
  `Ready: ${drafts.providers.length} providers, ${drafts.locations.length} locations, ` +
    `${drafts.camps.length} camps, ${drafts.sessions.length} sessions, ${drafts.options.length} options.`,
);

if (!process.argv.includes('--yes')) {
  console.log('Dry run: nothing written. Re-run with --yes to write drafts.');
  process.exit(0);
}

const url = required('NEXT_PUBLIC_SUPABASE_URL');
const client = createClient(url, required('SUPABASE_SECRET_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
console.log(`Writing drafts to ${new URL(url).host}`);

const summary = await importDrafts(client, drafts, {
  log: (line) => console.log(`  ${line}`),
  async readDocument(path) {
    const local = LOCAL_DOCUMENTS.get(path);
    if (local === undefined) throw new Error(`No local copy of source document ${path}`);
    return new Uint8Array(await readFile(local));
  },
  async uploadDocument(path, bytes) {
    const extension = path.split('.').pop()?.toLowerCase() ?? '';
    const { error } = await client.storage.from(DOCUMENT_BUCKET).upload(path, bytes, {
      contentType: CONTENT_TYPES.get(extension) ?? 'application/octet-stream',
      // A re-run after clearing a partial import finds the file already there.
      upsert: true,
    });
    if (error) throw new Error(`Could not upload ${path}: ${error.message}`);
  },
});
console.log('Done:', summary);
