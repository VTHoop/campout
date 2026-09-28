import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RegistrationKind, type SessionCardView } from '@/lib/catalog/session-cards';
import { Category } from '@/lib/catalog/types';
import { SessionCard } from './session-card';

/**
 * The session card (CAM-32; Design Foundation p.2). Real layout — wrapping at
 * 375px and 44px targets — is covered in e2e/session-cards.spec.ts.
 */

const IRONBRIDGE: SessionCardView = {
  id: 'session-vcu-ironbridge',
  campName: 'VCU Baseball Summer Youth Camps',
  providerName: 'VCU Baseball',
  locationName: 'Ironbridge Sports Park',
  city: 'Chester',
  startDate: '2026-08-03',
  endDate: '2026-08-05',
  startTime: '09:00',
  endTime: '12:00',
  priceCents: 29_900,
  categories: [Category.Sports],
  registration: { kind: RegistrationKind.Register, url: 'https://ramsbaseballcamps.com' },
};

const UNSTATED: SessionCardView = {
  id: 'session-magical-mess',
  campName: 'Magical Mess',
  providerName: 'acac',
  locationName: 'acac Midlothian',
  city: 'Midlothian',
  startDate: '2026-06-08',
  endDate: '2026-06-12',
  categories: [Category.Arts],
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
    const item = renderCard(IRONBRIDGE);
    expect(
      within(item).getByRole('heading', { name: 'VCU Baseball Summer Youth Camps' }),
    ).toBeInTheDocument();
  });

  it('names the provider and where the session runs', () => {
    renderCard(IRONBRIDGE);
    expect(screen.getByText('VCU Baseball at Ironbridge Sports Park, Chester')).toBeInTheDocument();
  });

  describe('week tab', () => {
    it('shows the week, month, dates and days', () => {
      renderCard(IRONBRIDGE);
      const tab = screen.getByTestId('week-tab');
      for (const text of ['Week 10', 'Aug', '3–5', 'Mon–Wed']) {
        expect(within(tab).getByText(text)).toBeInTheDocument();
      }
    });

    it('reads as one phrase', () => {
      renderCard(IRONBRIDGE);
      expect(screen.getByText('Week 10, August 3 to 5, Monday to Wednesday')).toBeInTheDocument();
      for (const piece of ['Week 10', 'Aug', '3–5', 'Mon–Wed']) {
        expect(screen.getByText(piece).closest('[aria-hidden="true"]')).not.toBeNull();
      }
    });

    it('sets a partial span in brick', () => {
      renderCard(IRONBRIDGE);
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
      renderCard({ ...IRONBRIDGE, ageRange: { min: 5, max: 15 }, gradeRange: { min: 0, max: 5 } });
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
      renderCard({ ...IRONBRIDGE, priceNote: 'acac member price: $225' });
      expect(screen.getByText('acac member price: $225')).toBeInTheDocument();
    });
  });

  it('shows every category as a word beside a decorative dot', () => {
    renderCard({ ...IRONBRIDGE, categories: [Category.Sports, Category.FaithBased] });
    for (const word of ['Sports', 'Faith-based']) {
      const category = screen.getByText(word);
      expect(category.parentElement?.querySelector('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  describe('partial-week callout', () => {
    it('says how many days a short session covers, and that it ends at noon', () => {
      renderCard(IRONBRIDGE);
      expect(screen.getByText('Covers 3 of 5 days, and ends at noon')).toBeInTheDocument();
    });

    it('is absent for a full week', () => {
      renderCard(UNSTATED, 2);
      expect(screen.queryByText(/^Covers/)).toBeNull();
    });
  });

  describe('registration', () => {
    it("links to the camp's registration page", () => {
      renderCard(IRONBRIDGE);
      expect(screen.getByRole('link', { name: "Register on the camp's site" })).toHaveAttribute(
        'href',
        'https://ramsbaseballcamps.com',
      );
    });

    it('dials the camp when it has only a phone number', () => {
      renderCard({
        ...IRONBRIDGE,
        registration: { kind: RegistrationKind.Call, phone: '804-378-1616' },
      });
      expect(screen.getByRole('link', { name: 'Call 804-378-1616' })).toHaveAttribute(
        'href',
        'tel:804-378-1616',
      );
    });

    it("links to the camp's site when that is all there is", () => {
      renderCard({
        ...IRONBRIDGE,
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
      renderCard({ ...IRONBRIDGE, registrationNotes: 'Register on the acac app.' });
      expect(screen.getByText('Register on the acac app.')).toBeInTheDocument();
    });
  });

  it('ranks nothing and claims no verification', () => {
    renderCard(IRONBRIDGE);
    expect(screen.queryByText(/verified|popular|top pick|recommended/i)).toBeNull();
  });
});
