import { describe, expect, it } from 'vitest';
import { planOf } from './intake-fixtures';
import { IntakeKind } from './plan';
import { formatReport, type IntakeResult } from './report';

const NOTHING: IntakeResult = { drafted: [], updated: [] };

const RESULT: IntakeResult = {
  drafted: [
    { kind: IntakeKind.Camp, id: 'camp-1', name: 'Intake Day Camp' },
    { kind: IntakeKind.Session, id: 'session-1', name: 'Intake Day Camp, 2027-07-12' },
  ],
  updated: [
    {
      kind: IntakeKind.Camp,
      id: 'camp-2',
      fields: ['name', 'summary'],
      setBackToDraft: { kind: IntakeKind.Camp, id: 'camp-2' },
    },
    { kind: IntakeKind.Session, id: 'session-2', fields: ['theme'] },
  ],
};

const PLAN = planOf({
  skipped: [{ what: 'Intake Day Camp, week of 2027-07-05', reason: 'the source states no dates' }],
  blanks: [{ record: 'session 2027-07-12', field: 'max_age', question: 'Is 12 the top age?' }],
});

describe('formatReport', () => {
  it('lists what was drafted, each with its kind, name and id', () => {
    const report = formatReport(PLAN, RESULT);
    expect(report).toContain('Drafted (2):');
    expect(report).toContain('camp  Intake Day Camp  camp-1');
    expect(report).toContain('session  Intake Day Camp, 2027-07-12  session-1');
  });

  it('lists what was updated and which fields, and what to re-approve from its card', () => {
    const report = formatReport(PLAN, RESULT);
    expect(report).toContain('Updated (2):');
    expect(report).toContain('camp camp-2: name, summary');
    expect(report).toContain('set back to draft: re-approve camp camp-2 from its card');
    expect(report).toContain('session session-2: theme');
  });

  it('lists each skip with its reason', () => {
    expect(formatReport(PLAN, NOTHING)).toContain(
      'Skipped (1):\n  Intake Day Camp, week of 2027-07-05: the source states no dates',
    );
  });

  it('lists each fact left blank, with the question that left it open', () => {
    expect(formatReport(PLAN, NOTHING)).toContain(
      'Left blank (1):\n  session 2027-07-12 · max_age: Is 12 the top age?',
    );
  });

  it('says so when a section is empty', () => {
    const report = formatReport(planOf({}), NOTHING);
    expect(report).toContain('Drafted (0): nothing');
    expect(report).toContain('Updated (0): nothing');
    expect(report).toContain('Skipped (0): nothing');
    expect(report).toContain('Left blank (0): nothing');
  });

  it('says nothing was written to a record put back to draft before a refusal, and what to re-approve', () => {
    const report = formatReport(planOf({}), {
      drafted: [],
      updated: [
        {
          kind: IntakeKind.Camp,
          id: 'camp-3',
          fields: [],
          setBackToDraft: { kind: IntakeKind.Camp, id: 'camp-3' },
        },
      ],
      refusal: 'new row violates check constraint',
    });
    expect(report).toContain('camp camp-3: nothing written');
    expect(report).toContain('set back to draft: re-approve camp camp-3 from its card');
  });

  it('opens with the refusal, and says what was written before it stays as drafts', () => {
    const report = formatReport(PLAN, { ...RESULT, refusal: 'new row violates check constraint' });
    expect(report.split('\n')[0]).toBe(
      'Stopped at the first refusal: new row violates check constraint',
    );
    expect(report).toContain('Everything under Drafted and Updated was written, as drafts.');
  });
});
