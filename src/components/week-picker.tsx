// Stub for the red commit (CAM-30).
import type { CoverageWeek } from '@campout/planner';

export interface ScrollMeasure {
  readonly scrollLeft: number;
  readonly clientWidth: number;
  readonly scrollWidth: number;
}

export interface ScrollState {
  readonly overflows: boolean;
  readonly canGoEarlier: boolean;
  readonly canGoLater: boolean;
}

export function scrollState(_measure: ScrollMeasure): ScrollState {
  return { overflows: false, canGoEarlier: false, canGoLater: false };
}

export function WeekPicker(_props: { weeks: readonly CoverageWeek[] }) {
  return null;
}
