import { weeksBetween } from '@campout/planner';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { scrollState, WeekPicker } from './week-picker';

/**
 * The week picker (CAM-30). jsdom has no layout, so the arrows — which only
 * appear when the row overflows — are covered through `scrollState` here and
 * in a real browser by e2e/week-picker.spec.ts.
 *
 * School shuts on Wednesday June 9, so week 1 is partial (Wed–Fri), and summer
 * runs to Friday July 2: four weeks.
 */
const WEEKS = weeksBetween('2027-06-09', '2027-07-02');

function tiles() {
  return screen.getAllByRole('button', { name: /^Week \d+,/ });
}

function tile(number: number) {
  return screen.getByRole('button', { name: new RegExp(`^Week ${number},`) });
}

describe('WeekPicker', () => {
  it('shows one tile per week, in order, named for its number and its Monday', () => {
    render(<WeekPicker weeks={WEEKS} />);
    expect(tiles().map((t) => t.getAttribute('aria-label'))).toEqual([
      'Week 1, Monday June 7',
      'Week 2, Monday June 14',
      'Week 3, Monday June 21',
      'Week 4, Monday June 28',
    ]);
  });

  it('shows the week number over its Monday, and nothing else', () => {
    render(<WeekPicker weeks={WEEKS} />);
    expect(tile(2).textContent).toBe('2Jun 14');
  });

  it('shows a partial week like any other, with no marker', () => {
    render(<WeekPicker weeks={WEEKS} />);
    expect(tile(1).textContent).toBe('1Jun 7');
    expect(screen.queryByText(/partial/i)).toBeNull();
  });

  it('groups the tiles under an accessible name', () => {
    render(<WeekPicker weeks={WEEKS} />);
    expect(screen.getByRole('group', { name: 'Weeks of summer' })).toContainElement(tile(1));
  });

  it('selects week 1 on load, and only week 1', () => {
    render(<WeekPicker weeks={WEEKS} />);
    expect(screen.getAllByRole('button', { pressed: true })).toEqual([tile(1)]);
  });

  it('selects the tile clicked and deselects the one before it', () => {
    render(<WeekPicker weeks={WEEKS} />);
    fireEvent.click(tile(3));
    expect(screen.getAllByRole('button', { pressed: true })).toEqual([tile(3)]);
    expect(tile(1)).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps a selected tile selected when it is clicked again', () => {
    render(<WeekPicker weeks={WEEKS} />);
    fireEvent.click(tile(2));
    fireEvent.click(tile(2));
    expect(screen.getAllByRole('button', { pressed: true })).toEqual([tile(2)]);
  });

  it('shows no arrows when every week fits', () => {
    render(<WeekPicker weeks={WEEKS} />);
    expect(screen.queryByRole('button', { name: 'Earlier weeks' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Later weeks' })).toBeNull();
  });
});

describe('scrollState', () => {
  it('reports no overflow when the row is as wide as its tiles', () => {
    expect(scrollState({ scrollLeft: 0, clientWidth: 400, scrollWidth: 400 })).toEqual({
      overflows: false,
      canGoEarlier: false,
      canGoLater: false,
    });
  });

  it('at the start of an overflowing row, can only go later', () => {
    expect(scrollState({ scrollLeft: 0, clientWidth: 300, scrollWidth: 700 })).toEqual({
      overflows: true,
      canGoEarlier: false,
      canGoLater: true,
    });
  });

  it('in the middle of an overflowing row, can go either way', () => {
    expect(scrollState({ scrollLeft: 200, clientWidth: 300, scrollWidth: 700 })).toEqual({
      overflows: true,
      canGoEarlier: true,
      canGoLater: true,
    });
  });

  it('at the end of an overflowing row, can only go earlier', () => {
    expect(scrollState({ scrollLeft: 400, clientWidth: 300, scrollWidth: 700 })).toEqual({
      overflows: true,
      canGoEarlier: true,
      canGoLater: false,
    });
  });

  it('treats a sub-pixel remainder as the end, since browsers round scroll positions', () => {
    expect(scrollState({ scrollLeft: 399.5, clientWidth: 300, scrollWidth: 700 })).toEqual({
      overflows: true,
      canGoEarlier: true,
      canGoLater: false,
    });
  });
});
