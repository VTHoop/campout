import type { Camp, Session } from '../types';
import { Category } from '../types';

/**
 * SwimRVA's 2026 camps, from swimrichmond.org → Camps → Schedule/Pricing
 * (CAM-42). Transcribed as the mock model allows; what it can't hold is noted
 * against the CAM-27 decision it belongs to.
 *
 * - Where to be: several CSAC weeks spend a day or two at the Meadowbrook pool
 *   (3700 Cogbill Road, not in the catalog: no session is based there)
 *   (Thu Jun 25; Thu–Fri Jul 9–10; Tue–Wed Jul 14–15; Tue Jul 21; Thu–Fri
 *   Jul 30–31). A session has one location, so those days are lost.
 * - Who can come: a camper "must be 6 years old on or before the first day of
 *   the camp week". The model has no date an age is measured on.
 * - Skill: Summer League Tune-Up needs all four strokes, and Mermaid Camp needs
 *   Rapids membership or Swim School Station 7. The model has nowhere to say so.
 * - Also stated, not held: check-in 8–9 am and check-out 4–5 pm around the
 *   9–4 day; no more than 25 camp days in any three months; payment in full at
 *   registration; a fee to cancel within 13 days; financial aid.
 * - Left out, as undated: Winter Break Camp and the Summer League Preseason
 *   Clinics (dates "TBD").
 */

const PROVIDER = 'provider-swimrva';
const CSAC = 'location-swimrva-csac';
const NORTH = 'location-swimrva-north';

// A 5-day week is "$329 (normally $339)" when booked by May 31, for any week
// of the summer. The regular price is the price; the special goes in the note.
const WEEK_PRICE = 33_900;
const FOUR_DAY_PRICE = 26_900;
const WEEK_SPECIAL = '$329 if booked by May 31, 2026 (spring special)';

function register(eventId: number) {
  return {
    url: `https://swimrichmond.clubautomation.com/calendar/event-info?id=${String(eventId)}&style=0&isFrame=0`,
  };
}

export const swimRvaCamps: readonly Camp[] = [
  {
    id: 'camp-swimrva-summer-swim',
    name: 'SwimRVA Summer Swim Camp',
    description:
      'A full-day swim camp with several swim lessons a day, water safety, and dryland games.',
    providerId: PROVIDER,
    categories: [Category.Sports],
    registrationInfo: register(118),
  },
  {
    id: 'camp-swimrva-spring-break',
    name: 'SwimRVA Spring Break Camp',
    description: 'The summer swim camp, run over spring break.',
    providerId: PROVIDER,
    categories: [Category.Sports],
    registrationInfo: register(50),
  },
  {
    id: 'camp-swimrva-summer-league-tune-up',
    name: 'Summer League Tune-Up Camp',
    description: 'Starts, turns, and stroke technique for summer league swimmers.',
    providerId: PROVIDER,
    categories: [Category.Sports],
    registrationInfo: register(76),
  },
  {
    id: 'camp-swimrva-junior-lifeguarding',
    name: 'Junior Lifeguarding Camp',
    description: 'The American Red Cross Junior Lifeguarding course, with CPR and First Aid.',
    providerId: PROVIDER,
    categories: [Category.Sports],
    registrationInfo: register(127),
  },
  {
    id: 'camp-swimrva-water-sports',
    name: 'Water Sports Camp',
    description: 'A different water sport each day: water polo, kayaking, paddleboarding and more.',
    providerId: PROVIDER,
    categories: [Category.Sports, Category.Outdoors],
    registrationInfo: register(119),
  },
  {
    id: 'camp-swimrva-mermaid',
    name: 'Mermaid Camp',
    description: 'Swimming in mermaid tails, with themed games and crafts.',
    providerId: PROVIDER,
    categories: [Category.Sports, Category.Arts],
    registrationInfo: register(136),
  },
];

interface Week {
  readonly start: string;
  readonly end: string;
  readonly priceCents?: number;
  readonly special?: string;
}

const fullWeek = (start: string, end: string): Week => ({ start, end });

function sessions(
  campId: string,
  locationId: string,
  weeks: readonly Week[],
  ageRange: { min: number; max: number },
): Session[] {
  return weeks.map((week) => {
    // A regular-price week carries the spring special; a 4-day week only its own.
    const priceNote = week.priceCents === undefined ? WEEK_SPECIAL : week.special;
    return {
      id: `session-${campId.replace('camp-', '')}-${locationId.replace('location-swimrva-', '')}-${week.start}`,
      campId,
      locationId,
      startDate: week.start,
      endDate: week.end,
      startTime: '09:00',
      endTime: '16:00',
      priceCents: week.priceCents ?? WEEK_PRICE,
      ...(priceNote === undefined ? {} : { priceNote }),
      ageRange,
    };
  });
}

const CHILD = { min: 6, max: 12 };

export const swimRvaSessions: readonly Session[] = [
  ...sessions(
    'camp-swimrva-summer-swim',
    CSAC,
    [
      fullWeek('2026-06-01', '2026-06-05'),
      // Mon–Thu: no camp Friday, June 12.
      { start: '2026-06-08', end: '2026-06-11', priceCents: FOUR_DAY_PRICE },
      fullWeek('2026-06-15', '2026-06-19'),
      {
        start: '2026-06-22',
        end: '2026-06-25',
        priceCents: FOUR_DAY_PRICE,
        special: '$259 if booked by May 31, 2026 (spring special)',
      },
      fullWeek('2026-06-29', '2026-07-03'),
      fullWeek('2026-07-06', '2026-07-10'),
      fullWeek('2026-07-13', '2026-07-17'),
      // Tue–Fri.
      { start: '2026-07-21', end: '2026-07-24', priceCents: FOUR_DAY_PRICE },
      fullWeek('2026-07-27', '2026-07-31'),
      fullWeek('2026-08-03', '2026-08-07'),
      fullWeek('2026-08-10', '2026-08-14'),
    ],
    CHILD,
  ),
  ...sessions(
    'camp-swimrva-summer-swim',
    NORTH,
    [
      fullWeek('2026-06-08', '2026-06-12'),
      fullWeek('2026-06-15', '2026-06-19'),
      fullWeek('2026-06-22', '2026-06-26'),
      fullWeek('2026-06-29', '2026-07-03'),
      fullWeek('2026-07-06', '2026-07-10'),
      fullWeek('2026-07-13', '2026-07-17'),
      fullWeek('2026-07-20', '2026-07-24'),
      fullWeek('2026-07-27', '2026-07-31'),
      fullWeek('2026-08-03', '2026-08-07'),
    ],
    CHILD,
  ),
  {
    id: 'session-swimrva-spring-break-csac-2026-03-30',
    campId: 'camp-swimrva-spring-break',
    locationId: CSAC,
    startDate: '2026-03-30',
    endDate: '2026-04-03',
    startTime: '08:00',
    endTime: '17:00',
    priceCents: WEEK_PRICE,
    priceNote: WEEK_SPECIAL,
    ageRange: CHILD,
  },
  ...sessions(
    'camp-swimrva-summer-league-tune-up',
    CSAC,
    [fullWeek('2026-06-01', '2026-06-05'), fullWeek('2026-06-15', '2026-06-19')],
    { min: 9, max: 17 },
  ),
  ...sessions(
    'camp-swimrva-junior-lifeguarding',
    CSAC,
    [fullWeek('2026-06-29', '2026-07-03'), fullWeek('2026-08-03', '2026-08-07')],
    { min: 11, max: 14 },
  ),
  ...sessions(
    'camp-swimrva-water-sports',
    CSAC,
    [{ start: '2026-06-22', end: '2026-06-25', priceCents: FOUR_DAY_PRICE }],
    { min: 10, max: 15 },
  ),
  ...sessions('camp-swimrva-mermaid', CSAC, [fullWeek('2026-08-10', '2026-08-14')], {
    min: 8,
    max: 15,
  }),
];
