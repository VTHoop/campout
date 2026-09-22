import type { SchoolYearCalendar } from '@campout/planner';
import { describe, orderedCalendars } from '@campout/planner';

/**
 * A school-year calendar a skill has drafted for human review — not yet a
 * `school_calendars` row, because that table requires `verified_at`/
 * `verified_by` on every row (ADR-0012) and cannot hold an unverified one.
 */
export interface CalendarDraft {
  readonly calendar: SchoolYearCalendar;
  readonly sourceUrl?: string;
  readonly sourceDocumentPath?: string;
  /** Questions for the reviewer — a date the skill could not place, not a guess. */
  readonly flags: readonly string[];
}

/**
 * Structural invariants a draft must hold before a human reviews it: the
 * same consistency `orderedCalendars` already enforces for a live calendar,
 * plus the provenance ADR-0012 requires. Returns every issue at once rather
 * than throwing on the first, so a reviewer sees everything wrong with a
 * draft in one pass — the same reasoning as `findCatalogInconsistencies`.
 */
export function findDraftIssues(draft: CalendarDraft): string[] {
  return [...findStructuralIssues(draft.calendar), ...findProvenanceIssues(draft)];
}

function findStructuralIssues(calendar: SchoolYearCalendar): string[] {
  try {
    orderedCalendars([calendar]);
    return [];
  } catch (error) {
    return [(error as Error).message];
  }
}

function findProvenanceIssues(draft: CalendarDraft): string[] {
  if (draft.sourceUrl || draft.sourceDocumentPath) {
    return [];
  }
  return [
    `${describe(draft.calendar)} has neither sourceUrl nor sourceDocumentPath; ADR-0012 requires at least one`,
  ];
}
