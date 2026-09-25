'use client';

import type { CoverageWeek } from '@campout/planner';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { longMonthDay, shortMonthDay } from '@/lib/dates';

/**
 * The week picker, drawn from the prototype (CAM-30; DESIGN.md → *Filters*).
 *
 * One row of tiles on every viewport, one per week: the week number over its
 * Monday. Exactly one week is selected — week 1 on load — and for now selecting
 * one changes nothing else on the page. When the row overflows, arrows either
 * side page it a screenful at a time; swiping still scrolls it natively.
 *
 * Selection is styled from `aria-pressed`, so the colour cannot drift from the
 * state a screen reader hears.
 */

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

/** Browsers round scroll positions, so a remainder under a pixel is the end. */
const SUBPIXEL = 1;

const NO_OVERFLOW: ScrollState = { overflows: false, canGoEarlier: false, canGoLater: false };

export function scrollState({ scrollLeft, clientWidth, scrollWidth }: ScrollMeasure): ScrollState {
  const hidden = scrollWidth - clientWidth;
  return {
    overflows: hidden >= SUBPIXEL,
    canGoEarlier: scrollLeft >= SUBPIXEL,
    canGoLater: hidden - scrollLeft >= SUBPIXEL,
  };
}

function sameState(a: ScrollState, b: ScrollState): boolean {
  return (
    a.overflows === b.overflows &&
    a.canGoEarlier === b.canGoEarlier &&
    a.canGoLater === b.canGoLater
  );
}

/** Tracks whether the row overflows and which way it can still scroll. */
function useRowScroll() {
  const rowRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ScrollState>(NO_OVERFLOW);

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const next = scrollState(row);
    setState((previous) => (sameState(previous, next) ? previous : next));
  }, []);

  // Watch the row itself, not the window: its width also changes when the
  // arrows appear or go, and a resize observer reports its first size at once.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [measure]);

  const page = useCallback((direction: 1 | -1) => {
    const row = rowRef.current;
    if (row) row.scrollLeft += direction * row.clientWidth;
  }, []);

  return { rowRef, state, measure, page };
}

function ChevronIcon({ pointing }: { pointing: 'left' | 'right' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={pointing === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  );
}

const TILE =
  'group h-auto min-w-16 flex-1 snap-start flex-col gap-0 rounded-none py-2 lg:min-w-20 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper aria-pressed:hover:bg-ink';

function WeekTile({
  week,
  selected,
  onSelect,
}: {
  week: CoverageWeek;
  selected: boolean;
  onSelect: () => void;
}) {
  const number = week.index + 1;
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      aria-label={`Week ${number}, Monday ${longMonthDay(week.monday)}`}
      onClick={onSelect}
      className={TILE}
    >
      <span className="font-display text-title tabular-nums">{number}</span>
      <span className="text-caption tabular-nums text-ink-muted group-aria-pressed:text-paper">
        {shortMonthDay(week.monday)}
      </span>
    </Button>
  );
}

export function WeekPicker({ weeks }: { weeks: readonly CoverageWeek[] }) {
  const [selected, setSelected] = useState(0);
  const { rowRef, state, measure, page } = useRowScroll();

  return (
    <fieldset aria-label="Weeks of summer" className="flex min-w-0 flex-1 items-center gap-2">
      {state.overflows ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Earlier weeks"
          disabled={!state.canGoEarlier}
          onClick={() => page(-1)}
        >
          <ChevronIcon pointing="left" />
        </Button>
      ) : null}
      {/* The scroller is a div inside the fieldset: Chrome ignores scroll-snap on a fieldset. */}
      <div
        ref={rowRef}
        onScroll={measure}
        className="flex min-w-0 flex-1 snap-x snap-mandatory scroll-px-1 gap-2 overflow-x-auto p-1 motion-safe:scroll-smooth [scrollbar-width:none]"
      >
        {weeks.map((week) => (
          <WeekTile
            key={week.monday}
            week={week}
            selected={week.index === selected}
            onSelect={() => setSelected(week.index)}
          />
        ))}
      </div>
      {state.overflows ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Later weeks"
          disabled={!state.canGoLater}
          onClick={() => page(1)}
        >
          <ChevronIcon pointing="right" />
        </Button>
      ) : null}
    </fieldset>
  );
}
