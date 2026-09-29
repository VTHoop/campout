import type { Camp, Session } from '../types';
import { Category } from '../types';

/**
 * The School of Richmond Ballet's 2026 summer camps and classes, from
 * richmondballet.com → School → Summer (CAM-42). Transcribed as the mock model
 * allows; what it can't hold is noted against the CAM-27 decision it belongs to.
 *
 * - Meeting days: the classes and the Mini Intensive meet on set weekdays
 *   across a five-week term (Saturdays; Tue and Thu; one weekday). A session is
 *   a start and an end date, so each reads as meeting every day of the term.
 * - Time options: the Invitation to the Dance and Primary classes each offer
 *   two Saturday times; only the first is held.
 * - Grade basis: Minds In Motion is for "rising 5th–8th graders".
 * - Skill: SRB Dance Camp is "not for beginners" (a year of ballet), and the
 *   Mini Intensive needs Lower III or three years of training.
 * - Also stated, not held: 10% off when both a June and a July camp week are
 *   booked; a parent showing at the end of each camp week; closed Friday,
 *   June 19, for Juneteenth.
 */

const PROVIDER = 'provider-richmond-ballet';
const LOCATION = 'location-richmond-ballet';
const REGISTER = { url: 'https://app.thestudiodirector.com/richmondballet/portal.sd?page=Enroll' };
const TERM = { startDate: '2026-06-22', endDate: '2026-07-25' } as const;

function camp(id: string, name: string, description: string): Camp {
  return {
    id,
    name,
    description,
    providerId: PROVIDER,
    categories: [Category.Arts],
    registrationInfo: REGISTER,
  };
}

export const richmondBalletCamps: readonly Camp[] = [
  camp(
    'camp-srb-invitation-to-the-dance-camp',
    'Invitation to the Dance Camp',
    'A morning ballet camp built around a fairytale ballet, ending with a parent showing.',
  ),
  camp(
    'camp-srb-dance-camp',
    'SRB Dance Camp',
    'Ballet, theatre dance, character dance, and pantomime for dancers with some experience.',
  ),
  camp(
    'camp-srb-minds-in-motion',
    'Minds In Motion Camp',
    'A full-day camp of dance, creative movement, music, and crafts.',
  ),
  camp(
    'camp-srb-lower-iii-mini-intensive',
    'Lower III Mini Intensive',
    'Ballet plus one other dance style, three late afternoons a week.',
  ),
  camp(
    'camp-srb-invitation-to-the-dance-class',
    'Invitation to the Dance (class)',
    'A weekly Saturday ballet class for the youngest dancers.',
  ),
  camp(
    'camp-srb-primary-class',
    'Pre-Primary & Primary (class)',
    'A weekly Saturday ballet class.',
  ),
  camp('camp-srb-lower-ballet', 'Lower Ballet (class)', 'Ballet class twice a week.'),
  camp(
    'camp-srb-lower-theatre-dance',
    'Lower Theatre Dance (class)',
    'A weekly theatre dance class.',
  ),
  camp(
    'camp-srb-lower-character-dance',
    'Lower Character Dance (class)',
    'A weekly character dance class.',
  ),
  camp('camp-srb-lower-modern', 'Lower Modern (class)', 'A weekly modern dance class.'),
];

const BOTH_WEEKS = (total: string) =>
  `10% off when the June and July weeks are booked together (${total} for both)`;

export const richmondBalletSessions: readonly Session[] = [
  {
    id: 'session-srb-invitation-to-the-dance-camp-2026-06-15',
    campId: 'camp-srb-invitation-to-the-dance-camp',
    locationId: LOCATION,
    startDate: '2026-06-15',
    endDate: '2026-06-18',
    startTime: '09:00',
    endTime: '11:00',
    priceCents: 18_000,
    priceNote: BOTH_WEEKS('$364.50'),
    ageRange: { min: 5, max: 7 },
  },
  {
    id: 'session-srb-invitation-to-the-dance-camp-2026-07-27',
    campId: 'camp-srb-invitation-to-the-dance-camp',
    locationId: LOCATION,
    startDate: '2026-07-27',
    endDate: '2026-07-31',
    startTime: '09:00',
    endTime: '11:00',
    priceCents: 22_500,
    priceNote: BOTH_WEEKS('$364.50'),
    ageRange: { min: 5, max: 7 },
  },
  {
    id: 'session-srb-dance-camp-2026-06-15',
    campId: 'camp-srb-dance-camp',
    locationId: LOCATION,
    startDate: '2026-06-15',
    endDate: '2026-06-18',
    startTime: '09:00',
    endTime: '14:00',
    priceCents: 34_000,
    priceNote: BOTH_WEEKS('$684'),
    ageRange: { min: 8, max: 12 },
  },
  {
    id: 'session-srb-dance-camp-2026-07-27',
    campId: 'camp-srb-dance-camp',
    locationId: LOCATION,
    startDate: '2026-07-27',
    endDate: '2026-07-31',
    startTime: '09:00',
    endTime: '14:00',
    priceCents: 42_000,
    priceNote: BOTH_WEEKS('$684'),
    ageRange: { min: 8, max: 12 },
  },
  ...(
    [
      ['2026-07-27', '2026-07-31'],
      ['2026-08-03', '2026-08-07'],
    ] as const
  ).map(
    ([startDate, endDate]): Session => ({
      id: `session-srb-minds-in-motion-${startDate}`,
      campId: 'camp-srb-minds-in-motion',
      locationId: LOCATION,
      startDate,
      endDate,
      startTime: '09:00',
      endTime: '16:00',
      priceCents: 35_000,
      gradeRange: { min: 5, max: 8 },
    }),
  ),
  {
    id: 'session-srb-lower-iii-mini-intensive-2026-06-23',
    campId: 'camp-srb-lower-iii-mini-intensive',
    locationId: LOCATION,
    startDate: '2026-06-23',
    endDate: '2026-07-23',
    startTime: '16:00',
    endTime: '18:30',
    priceCents: 51_500,
    priceNote: 'For the five-week session',
  },
  {
    id: 'session-srb-invitation-to-the-dance-class-2026-06-22',
    campId: 'camp-srb-invitation-to-the-dance-class',
    locationId: LOCATION,
    ...TERM,
    startTime: '09:00',
    endTime: '09:50',
    priceCents: 15_000,
    ageRange: { min: 4, max: 5 },
  },
  {
    id: 'session-srb-primary-class-2026-06-22',
    campId: 'camp-srb-primary-class',
    locationId: LOCATION,
    ...TERM,
    startTime: '10:50',
    endTime: '11:50',
    priceCents: 15_500,
    ageRange: { min: 6, max: 8 },
  },
  {
    id: 'session-srb-lower-ballet-2026-06-22',
    campId: 'camp-srb-lower-ballet',
    locationId: LOCATION,
    ...TERM,
    startTime: '16:30',
    endTime: '17:30',
    priceCents: 25_000,
    ageRange: { min: 8, max: 12 },
  },
  // Tuesday, Wednesday, and Thursday respectively, one hour each.
  ...[
    'camp-srb-lower-theatre-dance',
    'camp-srb-lower-character-dance',
    'camp-srb-lower-modern',
  ].map(
    (campId): Session => ({
      id: `session-${campId.replace('camp-', '')}-2026-06-22`,
      campId,
      locationId: LOCATION,
      ...TERM,
      startTime: '17:30',
      endTime: '18:30',
      priceCents: 19_500,
      ageRange: { min: 8, max: 12 },
    }),
  ),
];
