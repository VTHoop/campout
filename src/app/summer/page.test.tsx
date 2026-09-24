import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from './page';

describe('HomePage', () => {
  it('renders the summer derived from the planner package', () => {
    render(<HomePage />);
    expect(screen.getByTestId('week-count')).toHaveTextContent('10 weeks of summer');
  });

  it('lists every week of summer', () => {
    render(<HomePage />);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
  });
});
