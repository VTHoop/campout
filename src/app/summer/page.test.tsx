import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SummerPage, { metadata } from './page';

describe('SummerPage', () => {
  it('titles the browser tab Summer', () => {
    expect(metadata.title).toBe('Summer');
  });

  it('renders the summer derived from the planner package', () => {
    render(<SummerPage />);
    expect(screen.getByText('Chesterfield, 2027 · 10 weeks')).toBeInTheDocument();
  });

  it('lists every week of summer', () => {
    render(<SummerPage />);
    expect(screen.getAllByRole('button', { name: /^Week \d+, Monday / })).toHaveLength(10);
  });

  it('introduces the weeks as Your summer', () => {
    render(<SummerPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Your summer' })).toBeInTheDocument();
  });

  it('runs from the week of Monday June 14 to the week of Monday August 16', () => {
    render(<SummerPage />);
    const weeks = screen.getAllByRole('button', { name: /^Week \d+, Monday / });
    expect(weeks.at(0)).toHaveAccessibleName('Week 1, Monday June 14');
    expect(weeks.at(-1)).toHaveAccessibleName('Week 10, Monday August 16');
  });

  it('has no Browse all camps link and no gap count yet', () => {
    render(<SummerPage />);
    expect(screen.queryByRole('link', { name: /browse all camps/i })).toBeNull();
    expect(screen.queryByText(/still have a gap/i)).toBeNull();
  });
});
