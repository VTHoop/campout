import type { SupabaseClient } from '@supabase/supabase-js';
import type { DraftCatalog } from './map-catalog';

/**
 * The one-time import's writer (CAM-28): drafts in, rows out. It takes a
 * client rather than making one, so the secret key stays in the script that
 * runs it locally (ADR-0017 §3) and never in anything the app imports.
 */

/** The catalog already holds rows, so a second import would duplicate them. */
export class CatalogNotEmptyError extends Error {
  override name = 'CatalogNotEmptyError';
}

export interface ImportOptions {
  /** The bytes of a source document, by the path it is stored under in `camp-sources`. */
  readonly readDocument: (path: string) => Promise<Uint8Array>;
  /** Stores a document in `camp-sources` under `path`. The real one lives in the script. */
  readonly uploadDocument: (path: string, bytes: Uint8Array) => Promise<void>;
  readonly log?: (line: string) => void;
}

export interface ImportSummary {
  readonly providers: number;
  readonly locations: number;
  readonly camps: number;
  readonly sessions: number;
  readonly options: number;
  readonly documents: number;
}

/** Every table the import writes. A row in any of them means a run already happened. */
const IMPORTED_TABLES = ['providers', 'locations', 'camps', 'sessions', 'session_options'];

async function assertCatalogEmpty(client: SupabaseClient): Promise<void> {
  for (const table of IMPORTED_TABLES) {
    const { count, error } = await client.from(table).select('id', { count: 'exact', head: true });
    if (error) throw new Error(`Could not check ${table}: ${error.message}`);
    if ((count ?? 0) > 0)
      throw new CatalogNotEmptyError(
        `${table} already holds ${count} rows. The import runs once, on an empty catalog.`,
      );
  }
}

/** Refuse rather than guess: a draft pointing at a parent the import never wrote is a bug. */
function idOf(ids: ReadonlyMap<string, string>, ref: string, what: string): string {
  const id = ids.get(ref);
  if (id === undefined) throw new Error(`Import has no ${what} "${ref}"`);
  return id;
}

async function insertRow(client: SupabaseClient, table: string, row: object): Promise<string> {
  const { data, error } = await client.from(table).insert(row).select('id').single();
  if (error) throw new Error(`Could not insert into ${table}: ${error.message}`);
  return (data as { id: string }).id;
}

/** Each distinct document path the drafts cite as evidence, once. */
function documentPaths(drafts: DraftCatalog): readonly string[] {
  const rows = [...drafts.providers, ...drafts.locations, ...drafts.camps, ...drafts.sessions].map(
    ({ row }) => row.source_document_path,
  );
  return [...new Set(rows.filter((path) => path !== undefined && path !== null))];
}

async function uploadDocuments(
  paths: readonly string[],
  { readDocument, uploadDocument, log }: ImportOptions,
): Promise<void> {
  for (const path of paths) {
    await uploadDocument(path, await readDocument(path));
    log?.(`uploaded ${path}`);
  }
}

/** Insert in dependency order, one row at a time, so each parent's id is in hand for its children. */
async function insertDrafts(
  client: SupabaseClient,
  drafts: DraftCatalog,
  log: ImportOptions['log'],
): Promise<Omit<ImportSummary, 'documents'>> {
  const providers = new Map<string, string>();
  const locations = new Map<string, string>();
  const camps = new Map<string, string>();
  const sessions = new Map<string, string>();

  for (const { ref, row } of drafts.providers)
    providers.set(ref, await insertRow(client, 'providers', row));
  log?.(`wrote ${providers.size} providers`);

  for (const { ref, row } of drafts.locations)
    locations.set(ref, await insertRow(client, 'locations', row));
  log?.(`wrote ${locations.size} locations`);

  for (const { ref, providerRef, row } of drafts.camps) {
    const provider_id = idOf(providers, providerRef, 'provider');
    camps.set(ref, await insertRow(client, 'camps', { ...row, provider_id }));
  }
  log?.(`wrote ${camps.size} camps`);

  for (const { ref, campRef, locationRef, row } of drafts.sessions) {
    const camp_id = idOf(camps, campRef, 'camp');
    const location_id = idOf(locations, locationRef, 'location');
    sessions.set(ref, await insertRow(client, 'sessions', { ...row, camp_id, location_id }));
  }
  log?.(`wrote ${sessions.size} sessions`);

  for (const { sessionRef, row } of drafts.options) {
    const session_id = idOf(sessions, sessionRef, 'session');
    await insertRow(client, 'session_options', { ...row, session_id });
  }
  log?.(`wrote ${drafts.options.length} options`);

  return {
    providers: providers.size,
    locations: locations.size,
    camps: camps.size,
    sessions: sessions.size,
    options: drafts.options.length,
  };
}

/** Writes every draft, or nothing when the catalog already holds rows. */
export async function importDrafts(
  client: SupabaseClient,
  drafts: DraftCatalog,
  options: ImportOptions,
): Promise<ImportSummary> {
  await assertCatalogEmpty(client);
  const paths = documentPaths(drafts);
  await uploadDocuments(paths, options);
  const written = await insertDrafts(client, drafts, options.log);
  return { ...written, documents: paths.length };
}
