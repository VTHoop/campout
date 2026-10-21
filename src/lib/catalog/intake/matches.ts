import { RecordKind } from '../types';
import type { IntakePlan } from './plan';

/**
 * Likely matches between what a run would draft and what we already hold
 * (CAM-47): providers and camps by name, locations by `address_key`. A
 * proposal, not a decision. The owner confirms each at the checkpoint, and
 * the run refuses to write while one is unanswered. Duplicate detection
 * beyond this belongs to the review queue (CAM-3).
 */

type Status = 'draft' | 'verified' | 'archived';

/** The few columns of each held record a match needs. */
export interface HeldCatalog {
  readonly providers: readonly { id: string; name: string; status: Status }[];
  readonly camps: readonly { id: string; name: string; provider_id: string; status: Status }[];
  readonly locations: readonly {
    id: string;
    label: string;
    street: string;
    postal_code: string;
    address_key: string | null;
    status: Status;
  }[];
}

export interface Candidate {
  readonly id: string;
  readonly name: string;
  readonly status: Status;
}

/** A record the plan would draft, and the held records it may duplicate. */
export interface MatchProposal {
  readonly kind: RecordKind;
  readonly ref: string;
  readonly name: string;
  readonly candidates: readonly Candidate[];
}

/** Every planned-new record with at least one candidate the owner has not ruled out. */
export function proposeMatches(plan: IntakePlan, held: HeldCatalog): readonly MatchProposal[] {
  throw new Error(
    `not implemented: ${plan.providers.length} ${held.providers.length} ${RecordKind.Provider}`,
  );
}
