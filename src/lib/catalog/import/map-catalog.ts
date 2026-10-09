import type { Database } from '@/lib/db/types';
import type { CatalogSnapshot } from '../validateCatalog';

/**
 * The one-time import's mapping (CAM-28): the TypeScript mock's shape in, the
 * draft rows ADR-0017 and ADR-0018 settled out. Pure. The script that writes
 * them lives in `scripts/import-catalog.ts`.
 *
 * The database assigns every id, so rows link by `ref`, the mock's own id,
 * and the script resolves each ref to a uuid as it inserts in dependency order.
 */

type Tables = Database['public']['Tables'];

export interface DraftProvider {
  readonly ref: string;
  readonly row: Tables['providers']['Insert'];
}

export interface DraftLocation {
  readonly ref: string;
  readonly row: Tables['locations']['Insert'];
}

export interface DraftCamp {
  readonly ref: string;
  readonly providerRef: string;
  readonly row: Omit<Tables['camps']['Insert'], 'provider_id'>;
}

export interface DraftSession {
  readonly ref: string;
  readonly campRef: string;
  readonly locationRef: string;
  readonly row: Omit<Tables['sessions']['Insert'], 'camp_id' | 'location_id'>;
}

export interface DraftOption {
  readonly sessionRef: string;
  readonly row: Omit<Tables['session_options']['Insert'], 'session_id'>;
}

export interface DraftCatalog {
  readonly providers: readonly DraftProvider[];
  readonly locations: readonly DraftLocation[];
  readonly camps: readonly DraftCamp[];
  readonly sessions: readonly DraftSession[];
  readonly options: readonly DraftOption[];
}

/** What stops a record being imported, one line each. Empty means ready. */
export function findImportGaps(_catalog: CatalogSnapshot): string[] {
  throw new Error('not implemented');
}

/** Drafts for every record. Throws, listing every gap, if any record is not ready. */
export function mapCatalogToDrafts(_catalog: CatalogSnapshot): DraftCatalog {
  throw new Error('not implemented');
}
