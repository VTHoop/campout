import { describe, expect, it } from 'vitest';
import { cardFixture } from './catalog/session-card-fixtures';
import type { SessionCardView } from './catalog/session-cards';
import { cardsInWeek, weekIndexFrom } from './week-sessions';

/**
 * Which cards show under the selected week, and which week `?week=` selects
 * (CAM-32).
 */

function view(id: string, campName: string, startDate: string): SessionCardView {
  return cardFixture(id, campName, startDate, startDate, { categories: [] });
}

describe('cardsInWeek', () => {
  const CARDS = [
    view('thursday', 'Alpha', '2026-06-18'),
    view('monday-zulu', 'Zulu', '2026-06-15'),
    view('monday-bravo', 'Bravo', '2026-06-15'),
    view('sunday', 'Sunday camp', '2026-06-21'),
    view('week-before', 'Earlier', '2026-06-12'),
    view('week-after', 'Later', '2026-06-22'),
  ];

  it('keeps the cards whose session starts in the week, by start date then camp name', () => {
    expect(cardsInWeek(CARDS, '2026-06-15').map((card) => card.id)).toEqual([
      'monday-bravo',
      'monday-zulu',
      'thursday',
      'sunday',
    ]);
  });

  it('places a session by its start date, not its end date', () => {
    const spanning = { ...view('spanning', 'Spanning', '2026-06-12'), endDate: '2026-06-16' };
    expect(cardsInWeek([spanning], '2026-06-15')).toEqual([]);
    expect(cardsInWeek([spanning], '2026-06-08')).toEqual([spanning]);
  });

  it('is empty for a week with no sessions', () => {
    expect(cardsInWeek(CARDS, '2026-07-06')).toEqual([]);
  });
});

describe('weekIndexFrom', () => {
  it.each([
    ['1', 0],
    ['3', 2],
    ['12', 11],
  ])('reads week %s as index %i', (param, index) => {
    expect(weekIndexFrom(param, 12)).toBe(index);
  });

  it.each([
    ['missing', null],
    ['empty', ''],
    ['non-numeric', 'three'],
    ['partly numeric', '3a'],
    ['fractional', '2.5'],
    ['zero', '0'],
    ['negative', '-1'],
    ['past the last week', '13'],
  ])('falls back to week 1 when the parameter is %s', (_case, param) => {
    expect(weekIndexFrom(param, 12)).toBe(0);
  });
});
