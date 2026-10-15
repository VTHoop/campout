import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { chainFixture } from '@/lib/catalog/session-card-fixtures';
import {
  RegistrationKind,
  type SessionCardView,
  VerificationKind,
} from '@/lib/catalog/session-cards';
import { Category } from '@/lib/catalog/types';
import { SessionCard } from './session-card';

/**
 * The session card (CAM-32; Design Foundation p.2). Real layout — wrapping at
 * 375px and 44px targets — is covered in e2e/session-cards.spec.ts.
 */

const BASEBALL: SessionCardView = {
  id: 'session-baseball',
  campName: 'Fixture Baseball Camp',
  providerName: 'Fixture Provider',
  locationName: 'Fixture Park',
  city: 'Chester',
  startDate: '2026-08-03',
  endDate: '2026-08-05',
  startTime: '09:00',
  endTime: '12:00',
  priceCents: 29_900,
  categories: [Category.Sports],
  registration: { kind: RegistrationKind.Register, url: 'https://example.test/register' },
  verification: { kind: VerificationKind.Verified, on: '2026-05-01' },
  records: chainFixture({ sessionId: 'session-baseball', campName: 'Fixture Baseball Camp' }),
};

const UNSTATED: SessionCardView = {
  id: 'session-craft',
  campName: 'Fixture Craft Week',
  providerName: 'Fixture Provider',
  locationName: 'Fixture Park',
  city: 'Midlothian',
  startDate: '2026-06-08',
  endDate: '2026-06-12',
  categories: [Category.Arts],
  verification: { kind: VerificationKind.Verified, on: '2026-05-01' },
  records: chainFixture({ sessionId: 'session-craft', campName: 'Fixture Craft Week' }),
};

function renderCard(card: SessionCardView, weekNumber = 10) {
  render(
    <ul>
      <SessionCard card={card} weekNumber={weekNumber} />
    </ul>,
  );
  return screen.getByRole('listitem');
}

describe('SessionCard', () => {
  it('is a list item headed by the camp name', () => {
    const item = renderCard(BASEBALL);
    expect(
      within(item).getByRole('heading', { name: 'Fixture Baseball Camp' }),
    ).toBeInTheDocument();
  });

  it('names the provider and where the session runs', () => {
    renderCard(BASEBALL);
    expect(screen.getByText('Fixture Provider at Fixture Park, Chester')).toBeInTheDocument();
  });

  describe('week tab', () => {
    it('shows the week, month, dates and days', () => {
      renderCard(BASEBALL);
      const tab = screen.getByTestId('week-tab');
      for (const text of ['Week 10', 'Aug', '3–5', 'Mon–Wed']) {
        expect(within(tab).getByText(text)).toBeInTheDocument();
      }
    });

    it('reads as one phrase', () => {
      renderCard(BASEBALL);
      expect(screen.getByText('Week 10, August 3 to 5, Monday to Wednesday')).toBeInTheDocument();
      for (const piece of ['Week 10', 'Aug', '3–5', 'Mon–Wed']) {
        expect(screen.getByText(piece).closest('[aria-hidden="true"]')).not.toBeNull();
      }
    });

    it('sets a partial span in brick', () => {
      renderCard(BASEBALL);
      expect(screen.getByText('Mon–Wed')).toHaveClass('text-brick');
    });

    it('sets Monday to Friday in muted ink', () => {
      renderCard(UNSTATED, 2);
      expect(screen.getByText('Mon–Fri')).toHaveClass('text-ink-muted');
      expect(screen.getByText('Mon–Fri')).not.toHaveClass('text-brick');
    });
  });

  describe('data row', () => {
    it('shows the hours, ages, grades and price', () => {
      renderCard({ ...BASEBALL, ageRange: { min: 5, max: 15 }, gradeRange: { min: 0, max: 5 } });
      for (const text of ['9:00am – 12:00pm', 'Ages 5–15', 'Grades K–5', '$299']) {
        expect(screen.getByText(text)).toBeInTheDocument();
      }
    });

    it('says when the hours and price are not stated', () => {
      renderCard(UNSTATED, 2);
      expect(screen.getByText('Hours not stated')).toBeInTheDocument();
      expect(screen.getByText('Price not stated')).toBeInTheDocument();
    });

    it('omits unstated ages and grades', () => {
      renderCard(UNSTATED, 2);
      expect(screen.queryByText(/^Ages/)).toBeNull();
      expect(screen.queryByText(/^Grades/)).toBeNull();
    });

    it('shows the price note verbatim', () => {
      renderCard({ ...BASEBALL, priceNote: 'Member price: $225' });
      expect(screen.getByText('Member price: $225')).toBeInTheDocument();
    });
  });

  it('shows every category as a word beside a decorative dot', () => {
    renderCard({ ...BASEBALL, categories: [Category.Sports, Category.FaithBased] });
    for (const word of ['Sports', 'Faith-based']) {
      const category = screen.getByText(word);
      expect(category.parentElement?.querySelector('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  describe('partial-week callout', () => {
    it('says how many days a short session covers, and that it ends at noon', () => {
      renderCard(BASEBALL);
      expect(screen.getByText('Covers 3 of 5 days, and ends at noon')).toBeInTheDocument();
    });

    it('is absent for a full week', () => {
      renderCard(UNSTATED, 2);
      expect(screen.queryByText(/^Covers/)).toBeNull();
    });
  });

  describe('registration', () => {
    it("links to the camp's registration page", () => {
      renderCard(BASEBALL);
      expect(screen.getByRole('link', { name: "Register on the camp's site" })).toHaveAttribute(
        'href',
        'https://example.test/register',
      );
    });

    it('dials the camp when it has only a phone number', () => {
      renderCard({
        ...BASEBALL,
        registration: { kind: RegistrationKind.Call, phone: '804-555-0100' },
      });
      expect(screen.getByRole('link', { name: 'Call 804-555-0100' })).toHaveAttribute(
        'href',
        'tel:804-555-0100',
      );
    });

    it("links to the camp's site when that is all there is", () => {
      renderCard({
        ...BASEBALL,
        registration: { kind: RegistrationKind.Website, url: 'https://provider.example' },
      });
      expect(screen.getByRole('link', { name: "Camp's site" })).toHaveAttribute(
        'href',
        'https://provider.example',
      );
    });

    it('offers no button when there is nowhere to send the parent', () => {
      renderCard(UNSTATED, 2);
      expect(screen.queryByRole('link')).toBeNull();
    });

    it('shows the registration notes verbatim', () => {
      renderCard({ ...BASEBALL, registrationNotes: 'Register on the camp app.' });
      expect(screen.getByText('Register on the camp app.')).toBeInTheDocument();
    });
  });

  it('ranks nothing and recommends nothing', () => {
    renderCard(BASEBALL);
    expect(screen.queryByText(/popular|top pick|recommended|best/i)).toBeNull();
  });
  describe('verification', () => {
    it('says the day a verified session was checked', () => {
      renderCard(BASEBALL);
      expect(screen.getByText('Verified May 1, 2026')).toBeInTheDocument();
    });

    it('sits below a hairline, as the last thing on the card', () => {
      const item = renderCard(BASEBALL);
      const line = within(item).getByText('Verified May 1, 2026');
      expect(line).toHaveClass('border-t', 'border-rule');
      expect(item.lastElementChild?.lastElementChild).toBe(line);
    });

    it('flags a draft with a pill beside the camp name, and never says it is verified', () => {
      const item = renderCard({
        ...BASEBALL,
        verification: { kind: VerificationKind.Draft, sourceUrl: 'https://example.test/camps' },
      });
      const heading = within(item).getByRole('heading', { name: /Fixture Baseball Camp/ });
      expect(within(heading).getByText('Draft — not published')).toBeInTheDocument();
      expect(within(item).queryByText(/^Verified/)).toBeNull();
      expect(within(item).queryByText('Draft · not yet verified')).toBeNull();
    });

    it('puts no draft pill on a verified card', () => {
      const item = renderCard(BASEBALL);
      expect(within(item).queryByText('Draft — not published')).toBeNull();
    });

    it('links the page a draft was read from', () => {
      const item = renderCard({
        ...BASEBALL,
        verification: { kind: VerificationKind.Draft, sourceUrl: 'https://example.test/camps' },
      });
      expect(within(item).getByRole('link', { name: 'Show Source Information' })).toHaveAttribute(
        'href',
        'https://example.test/camps',
      );
    });

    it('offers no source link for a draft read from a stored document', () => {
      const item = renderCard({ ...BASEBALL, verification: { kind: VerificationKind.Draft } });
      expect(within(item).queryByRole('link', { name: 'Show Source Information' })).toBeNull();
      expect(within(item).queryByText('Draft · not yet verified')).toBeNull();
    });
  });
});
