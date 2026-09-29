import { describe, expect, it } from 'vitest';
import {
  DetailsError,
  DiscountKind,
  FeePer,
  LunchProvision,
  MembershipPeriod,
  parseCampDetails,
  parseOptionDetails,
  parseSessionDetails,
} from './details';

/**
 * The one typed reader of `details` (CAM-27 decision 12, ADR-0017 §5). The
 * database already checks each value against its vocabulary on write; this is
 * the app's side of the same contract, so a value that drifts from it fails
 * loudly instead of rendering as something it isn't.
 */

const CAMP_DETAILS = {
  activities: ['swimming', 'field games'],
  discounts: [
    { kind: 'sibling', percent_off: 10 },
    { kind: 'early_registration', amount_cents: 2500, deadline: '2027-03-31' },
  ],
  membership_required: { name: 'Fixture League membership', price_cents: 2000, period: 'year' },
  skill_required: 'Can swim one length unassisted',
  eligibility_wording: 'completed 4th grade',
  lunch: { provision: 'sold_separately', price_cents: 700 },
  policies: { cancellation: 'Full refund until May 1', switching_weeks: 'Free until June 1' },
  financial_aid: true,
  registration_opens: '2027-01-15',
};

const SESSION_DETAILS = {
  field_trips: [{ destination: 'Science museum', min_grade: 3, max_grade: 5 }],
  other_days: [{ date: '2027-07-15', location: 'Fixture Pool (200 Test Way)' }],
};

const OPTION_DETAILS = {
  daily_rate: { price_cents: 9000 },
  care_fees: {
    drop_off: { price_cents: 1000, per: 'day' },
    pickup: { price_cents: 0, per: 'session' },
  },
};

describe('parseCampDetails', () => {
  it('reads every key in the vocabulary', () => {
    const details = parseCampDetails(CAMP_DETAILS);

    expect(details).toEqual(CAMP_DETAILS);
    expect(details.lunch?.provision).toBe(LunchProvision.SoldSeparately);
    expect(details.membership_required?.period).toBe(MembershipPeriod.Year);
    expect(details.discounts?.map((discount) => discount.kind)).toEqual([
      DiscountKind.Sibling,
      DiscountKind.EarlyRegistration,
    ]);
  });

  it('reads an empty object as no details', () => {
    expect(parseCampDetails({})).toEqual({});
  });

  it.each([
    ['a key outside the vocabulary', { staff_ratio: '1:8' }, /details\.staff_ratio/],
    ['a yes/no that is text', { financial_aid: 'yes' }, /details\.financial_aid/],
    [
      'an unknown lunch provision',
      { lunch: { provision: 'catered' } },
      /details\.lunch\.provision/,
    ],
    ['a lunch with no provision', { lunch: { price_cents: 700 } }, /details\.lunch\.provision/],
    ['an empty activity', { activities: [''] }, /details\.activities\[0\]/],
    ['an activity that is prose', { activities: ['x'.repeat(41)] }, /details\.activities\[0\]/],
    ['activities that are not a list', { activities: 'swimming' }, /details\.activities/],
    [
      'a price in dollars',
      { lunch: { provision: 'sold_separately', price_cents: 7.5 } },
      /price_cents/,
    ],
    ['a negative price', { membership_required: { name: 'M', price_cents: -1 } }, /price_cents/],
    ['an impossible date', { registration_opens: '2027-02-30' }, /details\.registration_opens/],
    ['a date that is not text', { registration_opens: 20270115 }, /details\.registration_opens/],
    ['policies with nothing in them', { policies: {} }, /details\.policies/],
    [
      'a discount with both an amount and a percentage',
      { discounts: [{ kind: 'sibling', percent_off: 10, amount_cents: 500 }] },
      /details\.discounts\[0\]/,
    ],
    [
      'a discount with neither an amount nor a percentage',
      { discounts: [{ kind: 'sibling' }] },
      /details\.discounts\[0\]/,
    ],
    [
      'a discount over 100%',
      { discounts: [{ kind: 'sibling', percent_off: 101 }] },
      /details\.discounts\[0\]\.percent_off/,
    ],
  ])('refuses %s', (_case, details, path) => {
    expect(() => parseCampDetails(details)).toThrow(DetailsError);
    expect(() => parseCampDetails(details)).toThrow(path);
  });

  it.each([
    ['null', null],
    ['a list', []],
    ['text', 'swimming'],
  ])('refuses details that are %s rather than an object', (_case, details) => {
    expect(() => parseCampDetails(details)).toThrow(DetailsError);
  });
});

describe('parseSessionDetails', () => {
  it('reads every key in the vocabulary', () => {
    expect(parseSessionDetails(SESSION_DETAILS)).toEqual(SESSION_DETAILS);
  });

  it('reads a field trip with no grade band', () => {
    const details = parseSessionDetails({ field_trips: [{ destination: 'Zoo' }] });
    expect(details.field_trips).toEqual([{ destination: 'Zoo' }]);
  });

  it.each([
    ['a field trip with no destination', { field_trips: [{ min_grade: 3 }] }, /destination/],
    [
      'a grade outside pre-K to 12',
      { field_trips: [{ destination: 'Zoo', max_grade: 13 }] },
      /max_grade/,
    ],
    ['another day with no location', { other_days: [{ date: '2027-07-15' }] }, /location/],
    ['the camp’s description', { description: 'A week of fun!' }, /details\.description/],
  ])('refuses %s', (_case, details, path) => {
    expect(() => parseSessionDetails(details)).toThrow(DetailsError);
    expect(() => parseSessionDetails(details)).toThrow(path);
  });
});

describe('parseOptionDetails', () => {
  it('reads every key in the vocabulary', () => {
    const details = parseOptionDetails(OPTION_DETAILS);

    expect(details).toEqual(OPTION_DETAILS);
    expect(details.care_fees?.drop_off?.per).toBe(FeePer.Day);
  });

  it.each([
    ['a day rate that is a bare number', { daily_rate: 9000 }, /details\.daily_rate/],
    [
      'a care fee charged by the hour',
      { care_fees: { drop_off: { price_cents: 1000, per: 'hour' } } },
      /details\.care_fees\.drop_off\.per/,
    ],
    ['care fees with nothing in them', { care_fees: {} }, /details\.care_fees/],
    ['a price unit', { price_unit: 'week' }, /details\.price_unit/],
  ])('refuses %s', (_case, details, path) => {
    expect(() => parseOptionDetails(details)).toThrow(DetailsError);
    expect(() => parseOptionDetails(details)).toThrow(path);
  });
});
