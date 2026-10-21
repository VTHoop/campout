import type { SupabaseClient } from '@supabase/supabase-js';
import type { Difference } from './differences';
import type { HeldCatalog, MatchProposal } from './matches';
import type { IntakeKind, IntakePlan, PlannedUpdate } from './plan';
import type { IntakeResult } from './report';

/**
 * The intake writer (CAM-47): a confirmed plan in, draft rows out. It takes a
 * client rather than making one, so the secret key stays in the local script
 * that runs it (ADR-0017 §2) and never in anything the app imports. The key
 * can write drafts and nothing more: the guard trigger refuses any write that
 * would verify a row.
 *
 * There is no validator here. The database's constraints are the gate, and the
 * first row it refuses stops the run with its words (`IntakeRefusedError`).
 */

export interface WriteOptions {
  /** The bytes of a local source document. */
  readonly readDocument: (file: string) => Promise<Uint8Array>;
  /** Stores a document in `camp-sources` under `path`. The real one lives in the script. */
  readonly uploadDocument: (path: string, bytes: Uint8Array) => Promise<void>;
  readonly log?: (line: string) => void;
}

/** The database refused a row. Everything written before it stays, as drafts. */
export class IntakeRefusedError extends Error {
  override name = 'IntakeRefusedError';
  constructor(
    message: string,
    readonly result: IntakeResult,
  ) {
    super(message);
  }
}

/** The owner has not answered a proposed match, so nothing is written. */
export class UnansweredMatchError extends Error {
  override name = 'UnansweredMatchError';
  constructor(readonly proposals: readonly MatchProposal[]) {
    super(`${proposals.length} proposed match(es) are unanswered; confirm or rule out each first`);
  }
}

/** A verified record an update would put back to draft, and how many plan entries that hides. */
export interface UnpublishWarning {
  readonly kind: IntakeKind;
  readonly id: string;
  readonly plannedEntries: number;
}

export interface IntakePreview {
  readonly matches: readonly MatchProposal[];
  readonly differences: readonly {
    readonly update: PlannedUpdate;
    readonly differences: readonly Difference[];
  }[];
  readonly unpublishes: readonly UnpublishWarning[];
}

export async function readHeldCatalog(client: SupabaseClient): Promise<HeldCatalog> {
  throw new Error(`not implemented: ${typeof client}`);
}

/** Everything the checkpoint shows, read-only: it writes nothing. */
export async function previewIntake(
  client: SupabaseClient,
  plan: IntakePlan,
): Promise<IntakePreview> {
  throw new Error(`not implemented: ${typeof client} ${plan.providers.length}`);
}

/** Writes the plan's drafts and approved corrections, or nothing while a match is unanswered. */
export async function writeIntake(
  client: SupabaseClient,
  plan: IntakePlan,
  options: WriteOptions,
): Promise<IntakeResult> {
  throw new Error(`not implemented: ${typeof client} ${plan.providers.length} ${typeof options}`);
}
