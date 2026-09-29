import type { Camp, Session } from '../types';
import { Category } from '../types';

/**
 * The School of Richmond Ballet's 2026 summer camps, from richmondballet.com →
 * School → Summer (CAM-42). Transcribed as the mock model allows; what it can't
 * hold is noted against the CAM-27 decision it belongs to.
 *
 * - Grade basis: Minds In Motion is for "rising 5th–8th graders".
 * - Skill: SRB Dance Camp is "not for beginners" (a year of ballet).
 * - Also stated, not held: 10% off when both a June and a July camp week are
 *   booked; a parent showing at the end of each camp week; closed Friday,
 *   June 19, for Juneteenth.
 * - Left out, as out of scope: a session meets every weekday of its date range
 *   (CAM-27). The summer classes meet one or two days a week across a five-week
 *   term (Saturdays, or late afternoons), and the Lower III Mini Intensive meets
 *   Tuesday to Thursday, 4:00 to 6:30.
 */

const PROVIDER = 'provider-richmond-ballet';
const LOCATION = 'location-richmond-ballet';
const REGISTER = { url: 'https://app.thestudiodirector.com/richmondballet/portal.sd?page=Enroll' };

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
];
