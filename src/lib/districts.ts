import { SchoolDistrict } from '@campout/planner';

/** How each district is written for a parent. */
const NAMES = new Map(
  Object.entries({
    [SchoolDistrict.RichmondCity]: 'Richmond City',
    [SchoolDistrict.Chesterfield]: 'Chesterfield',
    [SchoolDistrict.Henrico]: 'Henrico',
    [SchoolDistrict.Hanover]: 'Hanover',
  } satisfies Record<SchoolDistrict, string>),
);

export function districtName(district: SchoolDistrict): string {
  const name = NAMES.get(district);
  if (name === undefined) throw new RangeError(`No display name for district "${district}"`);
  return name;
}
