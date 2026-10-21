import { RecordKind } from '../types';
import { addressKey, type IntakePlan, isExisting, isNew } from './plan';

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

/** A name with case, spacing and punctuation taken out: "S.C.O.R." and "SCOR" read the same. */
function squeezed(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** The same name, or one inside the other: "SCOR Richmond" may be "SCOR". */
function similar(a: string, b: string): boolean {
  const [x, y] = [squeezed(a), squeezed(b)];
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
}

function proposal(
  kind: RecordKind,
  planned: { readonly ref: string; readonly distinctFrom?: readonly string[] },
  name: string,
  candidates: readonly Candidate[],
): MatchProposal {
  const ruledOut = new Set(planned.distinctFrom ?? []);
  return {
    kind,
    ref: planned.ref,
    name,
    candidates: candidates.filter((candidate) => !ruledOut.has(candidate.id)),
  };
}

function providerProposals(plan: IntakePlan, held: HeldCatalog): MatchProposal[] {
  return plan.providers.filter(isNew).map((provider) =>
    proposal(
      RecordKind.Provider,
      provider,
      provider.facts.name,
      held.providers.filter((candidate) => similar(candidate.name, provider.facts.name)),
    ),
  );
}

function locationProposals(plan: IntakePlan, held: HeldCatalog): MatchProposal[] {
  return plan.locations.filter(isNew).map((location) => {
    const key = addressKey(location.facts.street, location.facts.postal_code);
    return proposal(
      RecordKind.Location,
      location,
      location.facts.label,
      held.locations
        .filter((candidate) => candidate.address_key === key)
        .map(({ id, label, status }) => ({ id, name: label, status })),
    );
  });
}

/** A camp can only duplicate one under a provider we already hold. */
function campProposals(plan: IntakePlan, held: HeldCatalog): MatchProposal[] {
  const heldProviders = new Map(
    plan.providers.filter(isExisting).map((provider) => [provider.ref, provider.existing]),
  );
  return plan.camps.filter(isNew).map((camp) => {
    const providerId = heldProviders.get(camp.providerRef);
    return proposal(
      RecordKind.Camp,
      camp,
      camp.facts.name,
      held.camps
        .filter((candidate) => candidate.provider_id === providerId)
        .filter((candidate) => similar(candidate.name, camp.facts.name))
        .map(({ id, name, status }) => ({ id, name, status })),
    );
  });
}

/** Every planned-new record with at least one candidate the owner has not ruled out. */
export function proposeMatches(plan: IntakePlan, held: HeldCatalog): readonly MatchProposal[] {
  return [
    ...providerProposals(plan, held),
    ...locationProposals(plan, held),
    ...campProposals(plan, held),
  ].filter((each) => each.candidates.length > 0);
}
