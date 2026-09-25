import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SummerPage, { metadata } from './page';

describe('SummerPage', () => {
  it('is headed Summer', () => {
    render(<SummerPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Summer');
  });

  it('titles the browser tab Summer', () => {
    expect(metadata.title).toBe('Summer');
  });

  it('renders the summer derived from the planner package', () => {
    render(<SummerPage />);
    expect(screen.getByTestId('week-count')).toHaveTextContent('10 weeks of summer');
  });

  it('lists every week of summer', () => {
    render(<SummerPage />);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
  });
});
