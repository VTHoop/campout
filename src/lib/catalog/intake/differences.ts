import type { Evidence, PlannedUpdate } from './plan';

/**
 * Where a source disagrees with a record we hold (CAM-47). The run lists each
 * difference at the checkpoint, field · ours · source · evidence, and writes
 * only the ones the owner said yes to.
 */

export interface Difference {
  readonly field: string;
  readonly ours: unknown;
  readonly source: unknown;
  /** The page, or the stored document in `camp-sources`, the source said it in. */
  readonly evidence: string;
}

function evidenceLabel(source: Evidence): string {
  return 'url' in source ? source.url : `camp-sources/${source.documentPath}`;
}

/** JSON with object keys sorted, so two values Postgres would store alike compare alike. */
function canonical(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, inner: unknown) =>
    inner !== null && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  );
}

/** Each field the update proposes whose value differs from the held row's. */
export function differences(
  held: Readonly<Record<string, unknown>>,
  update: PlannedUpdate,
): readonly Difference[] {
  const ours = new Map(Object.entries(held));
  return Object.entries(update.proposed)
    .filter(([field, source]) => canonical(ours.get(field)) !== canonical(source))
    .map(([field, source]) => ({
      field,
      ours: ours.get(field) ?? null,
      source,
      evidence: evidenceLabel(update.source),
    }));
}

/** The changes to write: approved fields that still differ, and nothing else. */
export function approvedChanges(
  held: Readonly<Record<string, unknown>>,
  update: PlannedUpdate,
): Record<string, unknown> {
  const approved = new Set(update.approved);
  return Object.fromEntries(
    differences(held, update)
      .filter((difference) => approved.has(difference.field))
      .map((difference) => [difference.field, difference.source]),
  );
}
