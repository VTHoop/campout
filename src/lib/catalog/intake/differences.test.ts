import { describe, expect, it } from 'vitest';
import { approvedChanges, differences } from './differences';
import { IntakeKind, type PlannedUpdate } from './plan';

const BROCHURE = 'https://example.test/intake/brochure-2027.pdf';

const HELD = {
  id: 'camp-id',
  name: 'Intake Tennis',
  summary: null,
  categories: ['sports'],
  status: 'verified',
};

function update(
  proposed: Record<string, unknown>,
  approved: readonly string[] = [],
): PlannedUpdate {
  return { kind: IntakeKind.Camp, id: 'camp-id', sourceUrl: BROCHURE, proposed, approved };
}

describe('differences', () => {
  it('lists each field the source states differently: field, ours, source, source URL', () => {
    expect(
      differences(HELD, update({ name: 'Intake Junior Tennis', summary: 'Ages 6–9.' })),
    ).toEqual([
      { field: 'name', ours: 'Intake Tennis', source: 'Intake Junior Tennis', sourceUrl: BROCHURE },
      { field: 'summary', ours: null, source: 'Ages 6–9.', sourceUrl: BROCHURE },
    ]);
  });

  it('does not list a field the source states the same way', () => {
    expect(differences(HELD, update({ name: 'Intake Tennis', categories: ['sports'] }))).toEqual(
      [],
    );
  });

  it('lists a list field whose members differ', () => {
    expect(differences(HELD, update({ categories: ['sports', 'outdoors'] }))).toEqual([
      {
        field: 'categories',
        ours: ['sports'],
        source: ['sports', 'outdoors'],
        sourceUrl: BROCHURE,
      },
    ]);
  });
});

describe('approvedChanges', () => {
  it('keeps only the fields the owner said yes to', () => {
    expect(
      approvedChanges(
        HELD,
        update({ name: 'Intake Junior Tennis', summary: 'Ages 6–9.' }, ['name']),
      ),
    ).toEqual({ name: 'Intake Junior Tennis' });
  });

  it('drops an approved field that no longer differs', () => {
    expect(approvedChanges(HELD, update({ name: 'Intake Tennis' }, ['name']))).toEqual({});
  });

  it('writes nothing the owner did not approve', () => {
    expect(approvedChanges(HELD, update({ name: 'Intake Junior Tennis' }))).toEqual({});
  });
});
