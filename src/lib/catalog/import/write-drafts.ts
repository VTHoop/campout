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

/** Writes every draft, or nothing when the catalog already holds rows. */
export function importDrafts(
  _client: SupabaseClient,
  _drafts: DraftCatalog,
  _options: ImportOptions,
): Promise<ImportSummary> {
  return Promise.reject(new Error('not implemented'));
}
