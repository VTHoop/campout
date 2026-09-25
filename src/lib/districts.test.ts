import { SchoolDistrict } from '@campout/planner';
import { describe, expect, it } from 'vitest';
import { districtName } from './districts';

describe('districtName', () => {
  it.each([
    [SchoolDistrict.RichmondCity, 'Richmond City'],
    [SchoolDistrict.Chesterfield, 'Chesterfield'],
    [SchoolDistrict.Henrico, 'Henrico'],
    [SchoolDistrict.Hanover, 'Hanover'],
  ])('names %s as %s', (district, expected) => {
    expect(districtName(district)).toBe(expected);
  });
});
