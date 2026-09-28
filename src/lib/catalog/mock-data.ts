import type { Camp, Location, Provider, Session } from './types';
import { Category } from './types';

export const mockProviders: readonly Provider[] = [
  { id: 'provider-acac', name: 'acac' },
  { id: 'provider-vcu-baseball', name: 'VCU Baseball', website: 'https://ramsbaseballcamps.com' },
];

export const mockLocations: readonly Location[] = [
  {
    id: 'location-acac-midlothian',
    name: 'acac Midlothian',
    address: '11621 Robious Road',
    city: 'Midlothian',
    state: 'VA',
  },
  {
    id: 'location-rfp-park',
    name: 'RF&P Park',
    address: '3400 Mountain Road',
    city: 'Glen Allen',
    state: 'VA',
  },
  {
    id: 'location-robious-athletic-complex',
    name: 'Robious Athletic Complex',
    address: '2801 Robious Crossing Drive',
    city: 'Midlothian',
    state: 'VA',
  },
  {
    id: 'location-ironbridge-sports-park',
    name: 'Ironbridge Sports Park',
    address: '11400 Iron Bridge Rd Ste 100',
    city: 'Chester',
    state: 'VA',
  },
];

// acac's enrollment page for Summer Camp 2026. It states what the brochure
// leaves out for the 12 themed weeks: hours, price, and grades.
const acacSummerCampRegistration = {
  url: 'https://acacmidlothian.campmanagement.com/p/request_for_info_m.php?action=enroll',
} as const;

// Every themed week is the same full-day camp, so they share the activities
// the enrollment page lists: "field trips, daily swimming, sports, arts and
// crafts, games and more", indoors and out. The theme is not a category.
const acacSummerCampCategories: readonly Category[] = [
  Category.Sports,
  Category.Arts,
  Category.Outdoors,
];

const acacTennisRegistration = {
  phone: '804-378-1616',
  notes: 'Register on the acac app or by calling the tennis desk.',
} as const;

export const mockCamps: readonly Camp[] = [
  {
    id: 'camp-wacky-water-welcome',
    name: 'Wacky Water Welcome',
    description:
      'Water-themed activities and games to kick off the summer, including an on-site foam party.',
    providerId: 'provider-acac',
    categories: acacSummerCampCategories,
    registrationInfo: acacSummerCampRegistration,
  },
  {
    id: 'camp-magical-mess',
    name: 'Magical Mess',
    description: 'Hands-on messy crafts and creative experiments for the week.',
    providerId: 'provider-acac',
    categories: acacSummerCampCategories,
    registrationInfo: acacSummerCampRegistration,
  },
  {
    id: 'camp-animal-planet',
    name: 'Animal Planet',
    description: 'An animal-themed week of games and learning activities about wildlife.',
    providerId: 'provider-acac',
    categories: acacSummerCampCategories,
    registrationInfo: acacSummerCampRegistration,
  },
  {
    id: 'camp-blast-from-the-past',
    name: 'Blast From the Past',
    description: 'A retro-themed week of throwback games and classic camp activities.',
    providerId: 'provider-acac',
    categories: acacSummerCampCategories,
    registrationInfo: acacSummerCampRegistration,
  },
  {
    id: 'camp-america-the-beautiful',
    name: 'America, the Beautiful',
    description:
      'A July 4th-themed week celebrating teamwork and community with red-white-and-blue activities.',
    providerId: 'provider-acac',
    categories: acacSummerCampCategories,
    registrationInfo: acacSummerCampRegistration,
  },
  {
    id: 'camp-hollywood',
    name: 'Camp Hollywood',
    description: 'A movie-and-performance-themed week of creative games and crafts.',
    providerId: 'provider-acac',
    categories: acacSummerCampCategories,
    registrationInfo: acacSummerCampRegistration,
  },
  {
    id: 'camp-global-games',
    name: 'Global Games',
    description:
      'An international games week of team competitions inspired by sports from around the world.',
    providerId: 'provider-acac',
    categories: acacSummerCampCategories,
    registrationInfo: acacSummerCampRegistration,
  },
  {
    id: 'camp-space-explorers',
    name: 'Space Explorers',
    description: 'A space-themed week exploring astronomy through games and activities.',
    providerId: 'provider-acac',
    categories: acacSummerCampCategories,
    registrationInfo: acacSummerCampRegistration,
  },
  {
    id: 'camp-glow-week',
    name: 'Glow Week',
    description: 'A neon and glow-in-the-dark themed week of crafts and high-energy games.',
    providerId: 'provider-acac',
    categories: acacSummerCampCategories,
    registrationInfo: acacSummerCampRegistration,
  },
  {
    id: 'camp-game-on',
    name: 'Game On!',
    description:
      'A video-game-themed week of team challenges and friendly multiplayer competitions.',
    providerId: 'provider-acac',
    categories: acacSummerCampCategories,
    registrationInfo: acacSummerCampRegistration,
  },
  {
    id: 'camp-surfs-up',
    name: "Surf's Up",
    description: 'A beach-themed week of water play, games, and creative crafts.',
    providerId: 'provider-acac',
    categories: acacSummerCampCategories,
    registrationInfo: acacSummerCampRegistration,
  },
  {
    id: 'camp-sayonara-summer',
    name: 'Sayonara Summer',
    description: 'A closing week of camper-favorite activities and an end-of-summer celebration.',
    providerId: 'provider-acac',
    categories: acacSummerCampCategories,
    registrationInfo: acacSummerCampRegistration,
  },
  {
    id: 'camp-junior-mini-tennis',
    name: 'Junior Mini Tennis Camp',
    description:
      'A half-day beginner tennis camp covering grip, footwork, and stroke fundamentals.',
    providerId: 'provider-acac',
    categories: [Category.Sports],
    registrationInfo: acacTennisRegistration,
  },
  {
    id: 'camp-tournament-all-day-tennis',
    name: 'Tournament All Day Camp',
    description:
      'A full-day intermediate/advanced tennis camp with practices Monday through Thursday and an optional Friday USTA-style tournament.',
    providerId: 'provider-acac',
    categories: [Category.Sports],
    registrationInfo: {
      ...acacTennisRegistration,
      notes: `${acacTennisRegistration.notes} The Friday tournament is optional for an additional fee (amount not stated).`,
    },
  },
  {
    id: 'camp-vcu-summer-youth',
    name: 'VCU Baseball Summer Youth Camps',
    description:
      'Youth baseball camps run by VCU Baseball at Richmond-area sports parks, open to any age or grade and limited only by roster size.',
    providerId: 'provider-vcu-baseball',
    categories: [Category.Sports],
    registrationInfo: { url: 'https://ramsbaseballcamps.com' },
  },
];

const generalCampSessions: readonly Session[] = [
  { campId: 'camp-wacky-water-welcome', startDate: '2026-06-01', endDate: '2026-06-05' },
  { campId: 'camp-magical-mess', startDate: '2026-06-08', endDate: '2026-06-12' },
  { campId: 'camp-animal-planet', startDate: '2026-06-15', endDate: '2026-06-19' },
  { campId: 'camp-blast-from-the-past', startDate: '2026-06-22', endDate: '2026-06-26' },
  { campId: 'camp-america-the-beautiful', startDate: '2026-06-29', endDate: '2026-07-03' },
  { campId: 'camp-hollywood', startDate: '2026-07-06', endDate: '2026-07-10' },
  { campId: 'camp-global-games', startDate: '2026-07-13', endDate: '2026-07-17' },
  { campId: 'camp-space-explorers', startDate: '2026-07-20', endDate: '2026-07-24' },
  // Brochure prints "June 27-31", which is not a real date (June has 30 days).
  // The enrollment page gives July 27-31.
  { campId: 'camp-glow-week', startDate: '2026-07-27', endDate: '2026-07-31' },
  { campId: 'camp-game-on', startDate: '2026-08-03', endDate: '2026-08-07' },
  { campId: 'camp-surfs-up', startDate: '2026-08-10', endDate: '2026-08-14' },
  { campId: 'camp-sayonara-summer', startDate: '2026-08-17', endDate: '2026-08-21' },
  // Hours, price, and grades are from the enrollment page: open 7 am - 6 pm,
  // $495/week ($440 for members), Kindergarten to 8th grade. No age range is
  // stated, so none is derived from the grades.
].map((session) => ({
  id: `session-${session.campId.replace('camp-', '')}`,
  campId: session.campId,
  locationId: 'location-acac-midlothian',
  startDate: session.startDate,
  endDate: session.endDate,
  startTime: '07:00',
  endTime: '18:00',
  priceCents: 49_500,
  priceNote: 'acac member price: $440/week',
  gradeRange: { min: 0, max: 8 },
}));

const juniorMiniTennisDateRanges: ReadonlyArray<readonly [string, string]> = [
  ['2026-06-01', '2026-06-05'],
  ['2026-06-08', '2026-06-12'],
  ['2026-06-22', '2026-06-26'],
  ['2026-06-29', '2026-07-03'],
  ['2026-07-06', '2026-07-10'],
  ['2026-07-13', '2026-07-17'],
  ['2026-07-27', '2026-07-31'],
  ['2026-08-03', '2026-08-07'],
  ['2026-08-10', '2026-08-14'],
];

const juniorMiniTennisSessions: readonly Session[] = juniorMiniTennisDateRanges.map(
  ([startDate, endDate], index) => ({
    id: `session-junior-mini-tennis-${index + 1}`,
    campId: 'camp-junior-mini-tennis',
    locationId: 'location-acac-midlothian',
    startDate,
    endDate,
    startTime: '10:30',
    endTime: '13:30',
    priceCents: 25_500,
    priceNote: 'acac member price: $225',
    ageRange: { min: 5, max: 15 },
  }),
);

const tournamentAllDayDateRanges: ReadonlyArray<readonly [string, string]> = [
  ['2026-06-15', '2026-06-18'],
  ['2026-07-20', '2026-07-23'],
  ['2026-08-17', '2026-08-20'],
];

const tournamentAllDaySessions: readonly Session[] = tournamentAllDayDateRanges.map(
  ([startDate, endDate], index) => ({
    id: `session-tournament-all-day-tennis-${index + 1}`,
    campId: 'camp-tournament-all-day-tennis',
    locationId: 'location-acac-midlothian',
    startDate,
    endDate,
    startTime: '10:00',
    endTime: '16:30',
    priceCents: 43_500,
    priceNote: 'acac member price: $395',
    ageRange: { min: 9, max: 18 },
  }),
);

const vcuSessions: readonly Session[] = [
  {
    id: 'session-vcu-rfp-week-1',
    campId: 'camp-vcu-summer-youth',
    locationId: 'location-rfp-park',
    startDate: '2026-06-15',
    endDate: '2026-06-19',
    startTime: '09:00',
    endTime: '14:00',
    priceCents: 41_500,
  },
  {
    id: 'session-vcu-robious',
    campId: 'camp-vcu-summer-youth',
    locationId: 'location-robious-athletic-complex',
    startDate: '2026-07-13',
    endDate: '2026-07-17',
    startTime: '09:00',
    endTime: '14:00',
    priceCents: 41_500,
  },
  {
    id: 'session-vcu-ironbridge',
    campId: 'camp-vcu-summer-youth',
    locationId: 'location-ironbridge-sports-park',
    startDate: '2026-08-03',
    endDate: '2026-08-05',
    startTime: '09:00',
    endTime: '12:00',
    priceCents: 29_900,
  },
  {
    id: 'session-vcu-rfp-week-2',
    campId: 'camp-vcu-summer-youth',
    locationId: 'location-rfp-park',
    startDate: '2026-08-10',
    endDate: '2026-08-14',
    startTime: '09:00',
    endTime: '14:00',
    priceCents: 41_500,
  },
];

export const mockSessions: readonly Session[] = [
  ...generalCampSessions,
  ...juniorMiniTennisSessions,
  ...tournamentAllDaySessions,
  ...vcuSessions,
];
