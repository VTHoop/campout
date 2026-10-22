import { describe, expect, it } from 'vitest';
import { campPlan, locationPlan, planOf, providerPlan } from './intake-fixtures';
import { type HeldCatalog, proposeMatches } from './matches';
import { IntakeKind } from './plan';

const HELD: HeldCatalog = {
  providers: [
    { id: 'p-scor', name: 'SCOR', status: 'verified' },
    { id: 'p-other', name: 'Fixture Swim Club', status: 'draft' },
  ],
  camps: [
    { id: 'c-summer', name: 'Summer Day Camp', provider_id: 'p-scor', status: 'verified' },
    { id: 'c-elsewhere', name: 'Summer Day Camp', provider_id: 'p-other', status: 'draft' },
  ],
  locations: [
    {
      id: 'l-scor',
      label: 'SCOR Sports Center',
      address_key: '1 fixture pkwy 23112',
      status: 'verified',
    },
  ],
};

const provider = (name: string, distinctFrom?: readonly string[]) =>
  providerPlan('x', { facts: { name }, ...(distinctFrom ? { distinctFrom } : {}) });

describe('proposeMatches', () => {
  it('proposes a held provider whose name is the same but for case and punctuation', () => {
    expect(proposeMatches(planOf({ providers: [provider('S.C.O.R.')] }), HELD)).toEqual([
      {
        kind: IntakeKind.Provider,
        ref: 'provider',
        name: 'S.C.O.R.',
        candidates: [{ id: 'p-scor', name: 'SCOR', status: 'verified' }],
      },
    ]);
  });

  it('proposes a held provider whose name contains the planned one, or the other way round', () => {
    const proposals = proposeMatches(planOf({ providers: [provider('SCOR Richmond')] }), HELD);
    expect(proposals.map((proposal) => proposal.candidates.map((c) => c.id))).toEqual([['p-scor']]);
  });

  it('proposes nothing for a provider with an unrelated name', () => {
    expect(proposeMatches(planOf({ providers: [provider('Ballet School')] }), HELD)).toEqual([]);
  });

  it('proposes a location by address_key, whatever its label', () => {
    const location = locationPlan('x', {
      facts: {
        label: 'Some Other Name',
        street: '1 Fixture Pkwy.',
        city: 'Chester',
        state: 'VA',
        postal_code: '23112',
      },
    });
    expect(proposeMatches(planOf({ locations: [location] }), HELD)).toEqual([
      {
        kind: IntakeKind.Location,
        ref: 'location',
        name: 'Some Other Name',
        candidates: [{ id: 'l-scor', name: 'SCOR Sports Center', status: 'verified' }],
      },
    ]);
  });

  it('proposes a camp only from under the existing provider it is planned for', () => {
    const plan = planOf({
      providers: [{ ref: 'provider', existing: 'p-scor' }],
      camps: [campPlan('x', { facts: { name: 'Summer Day Camp', categories: ['day_camp'] } })],
    });
    expect(proposeMatches(plan, HELD)).toEqual([
      {
        kind: IntakeKind.Camp,
        ref: 'camp',
        name: 'Summer Day Camp',
        candidates: [{ id: 'c-summer', name: 'Summer Day Camp', status: 'verified' }],
      },
    ]);
  });

  it('proposes no camp under a provider that is itself new', () => {
    const plan = planOf({
      providers: [provider('Ballet School')],
      camps: [campPlan('x', { facts: { name: 'Summer Day Camp', categories: ['day_camp'] } })],
    });
    expect(proposeMatches(plan, HELD)).toEqual([]);
  });

  it('proposes nothing for a record the owner already matched', () => {
    expect(
      proposeMatches(planOf({ providers: [{ ref: 'provider', existing: 'p-scor' }] }), HELD),
    ).toEqual([]);
  });

  it('leaves out a candidate the owner ruled out, and the proposal once all are', () => {
    expect(proposeMatches(planOf({ providers: [provider('SCOR', ['p-scor'])] }), HELD)).toEqual([]);
  });
});
