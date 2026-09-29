import type { Camp, Session } from '../types';
import { Category } from '../types';

/**
 * Sports Center of Richmond (SCOR), from scor-richmond.com → Camps and its
 * DaySmart registration listing (CAM-42). Transcribed as the mock model
 * allows; what it can't hold is noted against the CAM-27 decision it belongs to.
 *
 * - Summer weeks are SCOR's 2027 listing, the only summer with stated weeks:
 *   the camps page says 2026 started "the May 25th week" and gives no end. The
 *   listing was still being set up: weeks from July 12 show "0 events", and
 *   the June 28 week's first day reads 7/4/2027. The week's own title is used.
 * - Price: the listing shows $90 for a week, because a family books single days
 *   or the week. The camps page gives $90/day or $400/week. The model has one
 *   price with no unit, so a day rate reads as a week rate.
 * - Time options: full day 9–5, a morning half day 9–12:30, or an afternoon
 *   half day 1–5 ($55/day, $225/week). One session holds one time.
 * - Care: early drop-off at 8 and late pickup are $10 add-ons. The model has
 *   no care hours and no care price.
 * - Also stated, not held: a $20/year membership is required; same-day drop-ins
 *   cost $10 more; a holiday day runs only with at least 5 campers; ages 3–5
 *   come for half days only; SCOR may hold camp on snow days; lunch is $7.
 * - Left out, as undated or not daytime care: Lil' Kickers Wednesdays ("starting
 *   this September", no dates), Friday Night Out (6–9 pm, dates TBD), and the
 *   Friday Soccer Skills half days.
 */

const PROVIDER = 'provider-scor';
const LOCATION = 'location-scor';
const REGISTER = {
  url: 'https://member.daysmartrecreation.com/#/online/scor/programs/5/level?facility_ids=1',
};
const FULL_DAY_PRICE = 9_000;
const PRICE_NOTE =
  'Per day; $400 for the full week. Half day $55/day. $20/year SCOR membership required.';

export const scorCamps: readonly Camp[] = [
  {
    id: 'camp-scor-all-sports-summer',
    name: 'SCOR All Sports Summer Camp',
    description: 'A full day of indoor field games, an inflatable zone, and crafts.',
    providerId: PROVIDER,
    categories: [Category.Sports],
    registrationInfo: REGISTER,
  },
  {
    id: 'camp-scor-school-holiday',
    name: 'SCOR School Holiday Camp',
    description: 'The all-sports camp on days school is closed.',
    providerId: PROVIDER,
    categories: [Category.Sports],
    registrationInfo: REGISTER,
  },
];

function day(campId: string, start: string, end: string): Session {
  return {
    id: `session-${campId.replace('camp-', '')}-${start}`,
    campId,
    locationId: LOCATION,
    startDate: start,
    endDate: end,
    startTime: '09:00',
    endTime: '17:00',
    priceCents: FULL_DAY_PRICE,
    priceNote: PRICE_NOTE,
    ageRange: { min: 5, max: 12 },
  };
}

const SUMMER_2027_WEEKS: ReadonlyArray<readonly [string, string]> = [
  ['2027-05-31', '2027-06-04'],
  ['2027-06-07', '2027-06-11'],
  ['2027-06-14', '2027-06-18'],
  ['2027-06-21', '2027-06-25'],
  ['2027-06-28', '2027-07-02'],
  ['2027-07-05', '2027-07-09'],
  ['2027-07-12', '2027-07-16'],
  ['2027-07-19', '2027-07-23'],
  ['2027-07-26', '2027-07-30'],
  ['2027-08-02', '2027-08-06'],
];

// "Registration for 2026-2027 school holiday camps", as listed on the camps page.
const HOLIDAY_DAYS_2026_27 = [
  '2026-09-04',
  '2026-09-21',
  '2026-09-28',
  '2026-10-12',
  '2026-11-02',
  '2026-11-03',
  '2026-11-09',
  '2026-11-23',
  '2026-11-24',
  '2026-11-25',
  '2026-12-21',
  '2026-12-22',
  '2026-12-23',
  '2026-12-24',
  '2026-12-28',
  '2026-12-29',
  '2026-12-31',
];

export const scorSessions: readonly Session[] = [
  ...SUMMER_2027_WEEKS.map(([start, end]) => day('camp-scor-all-sports-summer', start, end)),
  ...HOLIDAY_DAYS_2026_27.map((date) => day('camp-scor-school-holiday', date, date)),
];
