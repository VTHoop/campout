import type { IntakeKind, IntakePlan } from './plan';

/**
 * The run report (CAM-47): what was drafted, what was updated, what was
 * skipped and why, and which facts were left blank. Printed after a write,
 * and after a refusal, so the owner knows what is in the database either way.
 */

export interface Drafted {
  readonly kind: IntakeKind;
  readonly id: string;
  readonly name: string;
}

export interface Updated {
  readonly kind: IntakeKind;
  readonly id: string;
  readonly fields: readonly string[];
  /** The record this put back to draft first, for the owner to re-approve from its card. */
  readonly setBackToDraft?: { readonly kind: IntakeKind; readonly id: string };
}

export interface IntakeResult {
  readonly drafted: readonly Drafted[];
  readonly updated: readonly Updated[];
  /** The database's own words, when it refused a row and the run stopped there. */
  readonly refusal?: string;
}

/** A titled list, two spaces in, or one line saying it is empty. */
function section<T>(title: string, items: readonly T[], lines: (item: T) => string[]): string[] {
  if (items.length === 0) return [`${title} (0): nothing`];
  return [`${title} (${items.length}):`, ...items.flatMap(lines).map((line) => `  ${line}`)];
}

function updatedLines(updated: Updated): string[] {
  const back = updated.setBackToDraft;
  return [
    `${updated.kind} ${updated.id}: ${updated.fields.join(', ') || 'nothing written'}`,
    ...(back ? [`  set back to draft: re-approve ${back.kind} ${back.id} from its card`] : []),
  ];
}

function refusalLines(refusal: string | undefined): string[] {
  if (refusal === undefined) return [];
  return [
    `Stopped at the first refusal: ${refusal}`,
    'Everything under Drafted and Updated was written, as drafts.',
    '',
  ];
}

export function formatReport(plan: IntakePlan, result: IntakeResult): string {
  return [
    ...refusalLines(result.refusal),
    ...section('Drafted', result.drafted, (row) => [`${row.kind}  ${row.name}  ${row.id}`]),
    ...section('Updated', result.updated, updatedLines),
    ...section('Skipped', plan.skipped, (skip) => [`${skip.what}: ${skip.reason}`]),
    ...section('Left blank', plan.blanks, (blank) => [
      `${blank.record} · ${blank.field}: ${blank.question}`,
    ]),
  ].join('\n');
}
