import type { CalendarDate } from './calendarDate';
import { assertCalendarDate, compareDates } from './calendarDate';
import type { Closure, SchoolYearCalendar } from './types';

/**
 * Validate a set of school-year calendars and put them in date order.
 *
 * Every rule here is one the database cannot express, or one that a caller
 * handing us a list could break: a record that contradicts itself is a bug, not
 * an input, and rendering it puts a wrong day on a parent's grid. So this throws
 * rather than repairing anything (AGENTS.md §1 — Refuse rather than guess).
 *
 * @throws RangeError on the first inconsistency found.
 */
export function orderedCalendars(
  calendars: readonly SchoolYearCalendar[],
): readonly SchoolYearCalendar[] {
  const ordered = calendars.map(assertConsistent).sort(byFirstDay);
  assertOneOwner(ordered);
  assertDistinctLabels(ordered);
  assertNoOverlap(ordered);
  return ordered;
}

function byFirstDay(a: SchoolYearCalendar, b: SchoolYearCalendar): number {
  return compareDates(a.firstInstructionalDay, b.firstInstructionalDay);
}

function describe(calendar: SchoolYearCalendar): string {
  return calendar.school
    ? `${calendar.district} ${calendar.school} ${calendar.label}`
    : `${calendar.district} ${calendar.label}`;
}

function assertConsistent(calendar: SchoolYearCalendar): SchoolYearCalendar {
  assertSpan(calendar);
  assertClosures(calendar);
  return calendar;
}

function assertSpan(calendar: SchoolYearCalendar): void {
  const who = describe(calendar);
  const first = assertCalendarDate(calendar.firstInstructionalDay, `${who} firstInstructionalDay`);
  const last = assertCalendarDate(calendar.lastInstructionalDay, `${who} lastInstructionalDay`);
  const from = assertCalendarDate(calendar.coversFrom, `${who} coversFrom`);
  const to = assertCalendarDate(calendar.coversTo, `${who} coversTo`);

  if (compareDates(last, first) <= 0) {
    throw new RangeError(`${who} ends instruction (${last}) on or before it starts (${first})`);
  }
  // Outside its window a record says nothing, so instruction cannot sit outside it.
  if (compareDates(from, first) > 0 || compareDates(last, to) > 0) {
    throw new RangeError(
      `${who} covers ${from} to ${to}, which does not contain its instructional days ${first} to ${last}`,
    );
  }
}

function assertClosures(calendar: SchoolYearCalendar): void {
  const who = describe(calendar);
  for (const closure of calendar.closures) {
    assertClosure(calendar, closure);
  }

  let previous: Closure | undefined;
  for (const closure of [...calendar.closures].sort(byStartDate)) {
    if (previous && compareDates(closure.startDate, previous.endDate) <= 0) {
      throw new RangeError(
        `${who} closures "${previous.sourceLabel}" and "${closure.sourceLabel}" share a day`,
      );
    }
    previous = closure;
  }
}

function byStartDate(a: Closure, b: Closure): number {
  return compareDates(a.startDate, b.startDate);
}

function assertClosure(calendar: SchoolYearCalendar, closure: Closure): void {
  const who = describe(calendar);
  const start = assertCalendarDate(closure.startDate, `${who} closure startDate`);
  const end = assertCalendarDate(closure.endDate, `${who} closure endDate`);

  if (compareDates(end, start) < 0) {
    throw new RangeError(
      `${who} closure "${closure.sourceLabel}" ends (${end}) before it starts (${start})`,
    );
  }
  // Time between school years is derived from the two calendars, never stored, so
  // a closure out there would be counted twice.
  if (isOutside(start, end, calendar)) {
    throw new RangeError(
      `${who} closure "${closure.sourceLabel}" (${start} to ${end}) falls outside its instructional days; time between school years is derived, not stored`,
    );
  }
}

function isOutside(start: CalendarDate, end: CalendarDate, calendar: SchoolYearCalendar): boolean {
  return (
    compareDates(start, calendar.firstInstructionalDay) < 0 ||
    compareDates(end, calendar.lastInstructionalDay) > 0
  );
}

function assertOneOwner(calendars: readonly SchoolYearCalendar[]): void {
  const [first, ...rest] = calendars;
  if (!first) return;

  for (const calendar of rest) {
    const sameSchool = (calendar.school ?? null) === (first.school ?? null);
    if (calendar.district !== first.district || !sameSchool) {
      throw new RangeError(
        `Calendars for ${describe(first)} and ${describe(calendar)} belong to different schools and cannot be combined`,
      );
    }
  }
}

function assertDistinctLabels(calendars: readonly SchoolYearCalendar[]): void {
  const seen = new Set<string>();
  for (const calendar of calendars) {
    if (seen.has(calendar.label)) {
      throw new RangeError(
        `Two calendars are labelled "${calendar.label}" for ${describe(calendar)}`,
      );
    }
    seen.add(calendar.label);
  }
}

function assertNoOverlap(calendars: readonly SchoolYearCalendar[]): void {
  let previous: SchoolYearCalendar | undefined;
  for (const calendar of calendars) {
    if (
      previous &&
      compareDates(calendar.firstInstructionalDay, previous.lastInstructionalDay) <= 0
    ) {
      throw new RangeError(
        `${describe(previous)} and ${describe(calendar)} overlap: the second starts before the first ends`,
      );
    }
    previous = calendar;
  }
}
