import type { PlannedUpdate } from './plan';

/**
 * Where a source disagrees with a record we hold (CAM-47). The run lists each
 * difference at the checkpoint, field · ours · source · source URL, and writes
 * only the ones the owner said yes to.
 */

export interface Difference {
  readonly field: string;
  readonly ours: unknown;
  readonly source: unknown;
  readonly sourceUrl: string;
}

/** Each field the update proposes whose value differs from the held row's. */
export function differences(
  held: Readonly<Record<string, unknown>>,
  update: PlannedUpdate,
): readonly Difference[] {
  throw new Error(`not implemented: ${Object.keys(held).length} ${update.id}`);
}

/** The changes to write: approved fields that still differ, and nothing else. */
export function approvedChanges(
  held: Readonly<Record<string, unknown>>,
  update: PlannedUpdate,
): Record<string, unknown> {
  throw new Error(`not implemented: ${Object.keys(held).length} ${update.id}`);
}
