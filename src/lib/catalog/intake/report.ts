import { IntakeKind, type IntakePlan } from './plan';

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

export function formatReport(plan: IntakePlan, result: IntakeResult): string {
  throw new Error(
    `not implemented: ${plan.skipped.length} ${result.drafted.length} ${IntakeKind.Camp}`,
  );
}
